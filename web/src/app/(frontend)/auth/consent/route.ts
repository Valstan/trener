import config from '@payload-config'
import { getPayload } from 'payload'
import { NextResponse } from 'next/server'

import { isParent } from '@/access/roles'
import { activeDocument, branchCanAcceptConsents } from '@/lib/legal'
import { operatorFromBranch } from '@/lib/operator'
import { relId } from '@/lib/relId'
import { clientMeta } from '@/lib/requestMeta'

// POST → родитель даёт согласие 152-ФЗ на обработку ПДн своих детей. Сервер берёт
// parent из сессии (не из клиента) и список детей — из привязки (readPlayers), чтобы
// нельзя было подписать согласие за чужого. Идемпотентно: повторная отправка не плодит
// записи.
//
// D-016: согласие пишется ДВУМЯ записями — операционной (consents, её читает
// consentGate) и журнальной (legal-signatures: hash действующей версии текста,
// IP, user-agent, снапшот реквизитов оператора). Филиал без завершённого
// юридического подключения согласия не принимает (жёсткий гейт).
export const dynamic = 'force-dynamic'

export const POST = async (req: Request): Promise<Response> => {
  try {
    const payload = await getPayload({ config })
    const { user } = await payload.auth({ headers: req.headers })
    if (!user || !isParent(user)) {
      return NextResponse.json({ ok: false }, { status: 401 })
    }

    const existing = await payload.find({
      collection: 'consents',
      where: { parent: { equals: user.id } },
      limit: 1,
      depth: 0,
      pagination: false,
      overrideAccess: true,
    })
    if (existing.docs.length > 0) {
      return NextResponse.json({ ok: true, redirect: '/' })
    }

    // Жёсткий гейт D-016 + документ, под которым подписываемся.
    const branchId = relId(user.branch)
    const branch =
      branchId != null
        ? await payload.findByID({ collection: 'branches', id: branchId, depth: 0, overrideAccess: true }).catch(() => null)
        : null
    if (!branch || !branchCanAcceptConsents(branch)) {
      return NextResponse.json({ ok: false, reason: 'branch-not-ready' }, { status: 409 })
    }
    const doc = await activeDocument(payload, 'parent_consent')
    if (!doc) return NextResponse.json({ ok: false, reason: 'no-document' }, { status: 409 })

    const players = await payload.find({
      collection: 'players',
      where: { parent: { equals: user.id } },
      limit: 100,
      depth: 0,
      pagination: false,
      user,
      overrideAccess: false,
    })
    const playerIds = players.docs.map((p) => p.id)

    await payload.create({
      collection: 'consents',
      data: {
        parent: user.id,
        players: playerIds,
        consentGiven: true,
        policyVersion: doc.version,
      },
      user,
      overrideAccess: false,
    })

    // Журнальная запись — неизменяемая: кто, когда (UTC), под чем (hash версии),
    // откуда и при каких реквизитах оператора.
    const meta = clientMeta(req)
    await payload.create({
      collection: 'legal-signatures',
      data: {
        kind: 'parent_consent',
        action: 'signed',
        document: doc.id,
        contentHash: doc.contentHash ?? '',
        branch: branch.id,
        signer: user.id,
        players: playerIds,
        signedAt: new Date().toISOString(),
        ip: meta.ip,
        userAgent: meta.userAgent,
        requisitesSnapshot: operatorFromBranch(branch) as unknown as Record<string, unknown>,
      },
      overrideAccess: true,
    })

    return NextResponse.json({ ok: true, redirect: '/' })
  } catch (err) {
    console.error('[auth/consent]', err)
    return NextResponse.json({ ok: false }, { status: 500 })
  }
}
