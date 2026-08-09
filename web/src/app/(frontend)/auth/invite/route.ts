import config from '@payload-config'
import { getPayload } from 'payload'
import { NextResponse } from 'next/server'

import { hasRole } from '@/access/roles'
import { createInviteToken } from '@/lib/auth/invite'
import { branchCanAcceptConsents } from '@/lib/legal'
import { relId } from '@/lib/relId'

// POST { playerId } → join-ссылка для приглашения родителя. Только персонал, и тренер —
// только для детей СВОИХ групп: проверяем не флагом роли, а попыткой прочитать Player
// ПОД ролью вызывающего (overrideAccess:false) — это переиспользует скоупинг #015
// (readPlayers вернёт ребёнка тренеру лишь если он в его группе).
export const dynamic = 'force-dynamic'

const serverBase = (): string =>
  (process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:3000').replace(/\/+$/, '')

export const POST = async (req: Request): Promise<Response> => {
  let playerId: number | string = ''
  try {
    const body = (await req.json()) as { playerId?: unknown }
    if (typeof body?.playerId === 'string' || typeof body?.playerId === 'number') {
      playerId = body.playerId
    }
  } catch {
    // пустой id обработаем ниже
  }
  if (playerId === '' || playerId === undefined || playerId === null) {
    return NextResponse.json({ ok: false }, { status: 400 })
  }

  try {
    const payload = await getPayload({ config })
    const { user } = await payload.auth({ headers: req.headers })
    if (!hasRole(user, 'owner', 'admin', 'coach')) {
      return NextResponse.json({ ok: false }, { status: 403 })
    }

    // Доступ к ребёнку под ролью вызывающего: тренеру отдаст только его группу.
    const player = await payload
      .findByID({ collection: 'players', id: playerId, depth: 0, user, overrideAccess: false })
      .catch(() => null)
    if (!player) return NextResponse.json({ ok: false }, { status: 403 })

    // Жёсткий гейт D-016: филиал без полных реквизитов и подписанного договора
    // поручения не приглашает родителей (иначе соберём привязки без права на согласие).
    const groupId = relId(player.group)
    let branchId = relId(player.branch)
    if (groupId != null) {
      const group = await payload
        .findByID({ collection: 'groups', id: groupId, depth: 0, overrideAccess: true })
        .catch(() => null)
      branchId = relId(group?.branch) ?? branchId
    }
    const branch =
      branchId != null
        ? await payload.findByID({ collection: 'branches', id: branchId, depth: 0, overrideAccess: true }).catch(() => null)
        : null
    if (!branch || !branchCanAcceptConsents(branch)) {
      return NextResponse.json(
        { ok: false, error: 'Филиал ещё не завершил юридическое подключение — приглашать родителей пока нельзя' },
        { status: 409 },
      )
    }

    const raw = await createInviteToken(payload, playerId)
    return NextResponse.json({ ok: true, joinUrl: `${serverBase()}/join/${raw}` })
  } catch (err) {
    console.error('[auth/invite]', err)
    return NextResponse.json({ ok: false }, { status: 500 })
  }
}
