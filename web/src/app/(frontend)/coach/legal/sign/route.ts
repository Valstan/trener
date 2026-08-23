import config from '@payload-config'
import { getPayload } from 'payload'
import { NextResponse } from 'next/server'

import { adminBranchId, hasRole, isDemo, isFullOwner } from '@/access/roles'
import { activeDocument, requisitesComplete } from '@/lib/legal'
import { operatorFromBranch } from '@/lib/operator'
import { clientMeta } from '@/lib/requestMeta'

// POST { branchId } → подписание договора поручения от имени школы (D-016).
// Гейты: владелец — любой филиал, админ — только свой; реквизиты оператора должны
// быть полными (подпись под пустым оператором хуже отсутствия подписи); повторная
// подпись — 409. Пишет неизменяемую журнальную запись + processorAgreementSignedAt
// в филиал (его использует isOperatorFinalized → branchCanAcceptConsents).
export const dynamic = 'force-dynamic'

export const POST = async (req: Request): Promise<Response> => {
  try {
    const payload = await getPayload({ config })
    const { user } = await payload.auth({ headers: req.headers })
    if (!user || !hasRole(user, 'owner', 'admin')) return NextResponse.json({ ok: false }, { status: 403 })
    // Демо не порождает юридических фактов (D-029/#166): подпись открыла бы приглашения
    // и импорт с письмами на произвольные адреса из публичной витрины.
    if (isDemo(user)) {
      return NextResponse.json(
        { error: 'В демо договор не подписывается — юридический контур показан без подписи' },
        { status: 400 },
      )
    }

    const body = (await req.json().catch(() => null)) as { branchId?: unknown } | null
    const branchId = Number(body?.branchId)
    if (!Number.isInteger(branchId) || branchId <= 0) return NextResponse.json({ ok: false }, { status: 400 })

    // Любой филиал — только ЖИВОЙ владелец; admin — свой. `isOwner` пропускал демо-владельца
    // (roles:['owner']) к подписи за чужой живой филиал — поддельная журнальная запись.
    const myBranch = adminBranchId(user)
    if (!isFullOwner(user) && String(myBranch) !== String(branchId)) {
      return NextResponse.json({ ok: false }, { status: 403 })
    }

    const branch = await payload
      .findByID({ collection: 'branches', id: branchId, depth: 0, overrideAccess: true })
      .catch(() => null)
    if (!branch) return NextResponse.json({ ok: false }, { status: 404 })
    if (branch.processorAgreementSignedAt) {
      return NextResponse.json({ error: 'Договор уже подписан' }, { status: 409 })
    }
    if (!requisitesComplete(branch)) {
      return NextResponse.json({ error: 'Сначала заполните реквизиты оператора филиала' }, { status: 400 })
    }

    const doc = await activeDocument(payload, 'processing_agreement')
    if (!doc) return NextResponse.json({ error: 'Текст договора ещё не опубликован' }, { status: 409 })

    const signedAt = new Date().toISOString()
    const meta = clientMeta(req)
    await payload.create({
      collection: 'legal-signatures',
      data: {
        kind: 'processing_agreement',
        action: 'signed',
        document: doc.id,
        contentHash: doc.contentHash ?? '',
        branch: branch.id,
        signer: user.id,
        signedAt,
        ip: meta.ip,
        userAgent: meta.userAgent,
        requisitesSnapshot: operatorFromBranch(branch) as unknown as Record<string, unknown>,
      },
      overrideAccess: true,
    })
    await payload.update({
      collection: 'branches',
      id: branch.id,
      data: { processorAgreementSignedAt: signedAt },
      overrideAccess: true,
    })

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[coach/legal/sign]', err)
    return NextResponse.json({ ok: false }, { status: 500 })
  }
}
