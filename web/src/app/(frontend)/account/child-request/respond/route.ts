import config from '@payload-config'
import { getPayload } from 'payload'
import { NextResponse } from 'next/server'

import { isParent } from '@/access/roles'
import { dedupFill, findDuplicateChild, type ExistingChild } from '@/lib/playerDedup'
import { relId } from '@/lib/relId'

// Родитель подтверждает (или отклоняет) заявку на своего ребёнка.
//
// ⚠️ Бэклог-п.11: раньше здесь было безусловное `create players`. Ребёнок, уже
// заведённый импортом (или привязанный к родителю по ссылке-приглашению), получал
// ВТОРОГО ребёнка с тем же именем: один ряд с группой, второй без — и тренер видел
// в группе не того, а coverage считался по двум. Теперь сначала сверка
// (`lib/playerDedup.ts`), и только если такого ребёнка нет — создание.

const toExistingChild = (player: {
  id: number
  name?: string | null
  dateOfBirth?: string | null
  account?: unknown
  branch?: unknown
}): ExistingChild => ({
  id: player.id,
  name: player.name ?? '',
  dateOfBirth: player.dateOfBirth ?? null,
  accountId: relId(player.account),
  branchId: relId(player.branch),
})

export const POST = async (req: Request): Promise<Response> => {
  const payload = await getPayload({ config }); const { user } = await payload.auth({ headers: req.headers })
  if (!user || !isParent(user)) return NextResponse.json({ ok: false }, { status: 403 })
  const body = await req.json().catch(() => null) as { requestId?: unknown; accept?: unknown } | null
  const requestId = Number(body?.requestId)
  if (!Number.isInteger(requestId) || typeof body?.accept !== 'boolean') return NextResponse.json({ ok: false }, { status: 400 })
  const found = await payload.find({ collection: 'child-registrations', where: { and: [{ id: { equals: requestId } }, { proposedParent: { equals: user.id } }, { status: { equals: 'parent_review' } }] }, limit: 1, depth: 0, overrideAccess: true })
  const request = found.docs[0]
  if (!request) return NextResponse.json({ ok: false }, { status: 404 })
  if (!body.accept) { await payload.update({ collection: 'child-registrations', id: request.id, data: { status: 'rejected' }, overrideAccess: true }); return NextResponse.json({ ok: true }) }

  const accountId = relId(request.account)
  const branchId = relId(request.branch) ?? relId(user.branch)
  const incoming = { name: request.childName, dateOfBirth: request.dateOfBirth, accountId, branchId }

  try {
    // Сверка только по детям ЭТОГО родителя (#015/152-ФЗ: чужие не читаются).
    const siblings = await payload.find({ collection: 'players', where: { parent: { equals: user.id } }, limit: 100, depth: 0, overrideAccess: true })
    const existing = siblings.docs.map(toExistingChild)
    const duplicate = findDuplicateChild(existing, incoming)

    if (duplicate) {
      // account уникален в схеме: если его уже держит другой ряд — не перевешиваем,
      // иначе упадёт весь запрос и родитель получит «не удалось».
      const accountTaken = existing.some((p) => p.id !== duplicate.id && accountId != null && p.accountId === accountId)
      const fill = dedupFill(duplicate, incoming, accountTaken)
      if (Object.keys(fill).length) {
        await payload.update({ collection: 'players', id: duplicate.id, data: fill, overrideAccess: true })
      }
      // Без ПДн (152-ФЗ): только id заявки и ребёнка.
      payload.logger.info(`[account/child-request] заявка ${request.id} склеена с ребёнком ${duplicate.id}`)
    } else {
      await payload.create({ collection: 'players', data: { name: request.childName, dateOfBirth: request.dateOfBirth, parent: user.id, account: accountId ?? undefined, branch: branchId ?? undefined }, overrideAccess: true })
    }

    await payload.update({ collection: 'users', id: relId(request.account)!, data: { roles: ['child'], requestedRole: 'child', status: 'approved', branch: branchId ?? undefined }, overrideAccess: true })
    await payload.update({ collection: 'child-registrations', id: request.id, data: { status: 'accepted' }, overrideAccess: true })
    return NextResponse.json({ ok: true, deduplicated: Boolean(duplicate) })
  } catch { return NextResponse.json({ ok: false }, { status: 409 }) }
}
