import config from '@payload-config'
import { getPayload } from 'payload'
import { NextResponse } from 'next/server'

import { hasRole } from '@/access/roles'
import { createInviteToken } from '@/lib/auth/invite'

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
    if (!hasRole(user, 'admin', 'coach')) {
      return NextResponse.json({ ok: false }, { status: 403 })
    }

    // Доступ к ребёнку под ролью вызывающего: тренеру отдаст только его группу.
    const player = await payload
      .findByID({ collection: 'players', id: playerId, depth: 0, user, overrideAccess: false })
      .catch(() => null)
    if (!player) return NextResponse.json({ ok: false }, { status: 403 })

    const raw = await createInviteToken(payload, playerId)
    return NextResponse.json({ ok: true, joinUrl: `${serverBase()}/join/${raw}` })
  } catch (err) {
    console.error('[auth/invite]', err)
    return NextResponse.json({ ok: false }, { status: 500 })
  }
}
