import config from '@payload-config'
import { getPayload } from 'payload'
import { NextResponse } from 'next/server'

import { isParent } from '@/access/roles'
import { activeDocument } from '@/lib/legal'
import { operatorFromBranch } from '@/lib/operator'
import { buildConsentWithdrawnMessage } from '@/lib/push/message'
import { sendPushToUser } from '@/lib/push/send'
import { relId } from '@/lib/relId'
import { clientMeta } from '@/lib/requestMeta'

// POST → отзыв согласия родителем (D-016 §5: отзыв — на сайте, дешевле сразу, чем
// прикручивать после первой просьбы). Механика:
//   • журнальная запись action=withdrawn (та же неизменяемая коллекция; ссылается
//     на версию/хэш, под которыми подписывались, — отзыв НЕ удаляет историю);
//   • операционная запись consents удаляется → consentGate снова заведёт родителя
//     на экран согласия (без согласия работа с данными ребёнка невозможна);
//   • пуш владельцам — школа должна узнать об отзыве сразу.
export const dynamic = 'force-dynamic'

export const POST = async (req: Request): Promise<Response> => {
  try {
    const payload = await getPayload({ config })
    const { user } = await payload.auth({ headers: req.headers })
    if (!user || !isParent(user)) return NextResponse.json({ ok: false }, { status: 401 })

    const consents = await payload.find({
      collection: 'consents',
      where: { parent: { equals: user.id } },
      limit: 10,
      depth: 0,
      pagination: false,
      overrideAccess: true,
    })
    if (!consents.docs.length) return NextResponse.json({ ok: false, reason: 'no-consent' }, { status: 409 })

    // Под чем подписывались: последняя журнальная запись signed; для легаси-согласий
    // (до D-016, журнала нет) ссылаемся на действующую версию документа.
    const lastSigned = await payload.find({
      collection: 'legal-signatures',
      where: {
        and: [
          { signer: { equals: user.id } },
          { kind: { equals: 'parent_consent' } },
          { action: { equals: 'signed' } },
        ],
      },
      sort: '-signedAt',
      limit: 1,
      depth: 0,
      pagination: false,
      overrideAccess: true,
    })
    const signedRef = lastSigned.docs[0] ?? null
    const fallbackDoc = signedRef ? null : await activeDocument(payload, 'parent_consent')
    const documentId = signedRef ? relId(signedRef.document) : (fallbackDoc?.id ?? null)
    if (documentId == null) return NextResponse.json({ ok: false, reason: 'no-document' }, { status: 409 })

    const branchId = relId(user.branch)
    const branch =
      branchId != null
        ? await payload.findByID({ collection: 'branches', id: branchId, depth: 0, overrideAccess: true }).catch(() => null)
        : null

    const meta = clientMeta(req)
    await payload.create({
      collection: 'legal-signatures',
      data: {
        kind: 'parent_consent',
        action: 'withdrawn',
        document: Number(documentId),
        contentHash: signedRef?.contentHash ?? fallbackDoc?.contentHash ?? '',
        branch: branch?.id ?? null,
        signer: user.id,
        signedAt: new Date().toISOString(),
        ip: meta.ip,
        userAgent: meta.userAgent,
        requisitesSnapshot: branch ? (operatorFromBranch(branch) as unknown as Record<string, unknown>) : undefined,
      },
      overrideAccess: true,
    })

    await payload.delete({
      collection: 'consents',
      where: { parent: { equals: user.id } },
      overrideAccess: true,
    })

    // Школа должна узнать об отзыве сразу (best-effort).
    try {
      const owners = await payload.find({ collection: 'users', where: { roles: { in: ['owner'] } }, depth: 0, limit: 20, pagination: false, overrideAccess: true })
      const message = buildConsentWithdrawnMessage()
      for (const owner of owners.docs) await sendPushToUser(payload, owner.id, message).catch(() => {})
    } catch (err) {
      payload.logger.warn({ err }, '[consent-withdraw] пуш владельцам не отправлен')
    }

    payload.logger.info({ userId: user.id }, '[consent-withdraw] согласие отозвано (журнал + удаление consents)')
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[account/consent-withdraw]', err)
    return NextResponse.json({ ok: false }, { status: 500 })
  }
}
