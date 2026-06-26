import config from '@payload-config'
import { getPayload } from 'payload'
import { NextResponse } from 'next/server'

import { isParent } from '@/access/roles'
import { relId } from '@/lib/relId'

// POST { sessionId, playerId, response: 'going'|'not_going' } → ответ родителя об
// участии ребёнка. #015: родитель отвечает ТОЛЬКО за своих детей (проверяем
// player.parent == сессия). Upsert по (session × player): повторный тап меняет ответ,
// не плодит записи (DB partial-unique придёт миграцией на M3, C4). server-mediated.
export const dynamic = 'force-dynamic'

export const POST = async (req: Request): Promise<Response> => {
  try {
    const payload = await getPayload({ config })
    const { user } = await payload.auth({ headers: req.headers })
    if (!user || !isParent(user)) return NextResponse.json({ ok: false }, { status: 401 })

    let sessionId: unknown
    let playerId: unknown
    let response: unknown
    try {
      const body = (await req.json()) as { sessionId?: unknown; playerId?: unknown; response?: unknown }
      sessionId = body?.sessionId
      playerId = body?.playerId
      response = body?.response
    } catch {
      // ниже 400
    }
    if (
      typeof sessionId !== 'number' ||
      typeof playerId !== 'number' ||
      (response !== 'going' && response !== 'not_going')
    ) {
      return NextResponse.json({ ok: false }, { status: 400 })
    }

    // владение: ребёнок принадлежит этому родителю
    const player = await payload
      .findByID({ collection: 'players', id: playerId, depth: 0, overrideAccess: true })
      .catch(() => null)
    if (!player || relId(player.parent) !== user.id) return NextResponse.json({ ok: false }, { status: 403 })

    const existing = await payload.find({
      collection: 'rsvps',
      where: { and: [{ session: { equals: sessionId } }, { player: { equals: playerId } }] },
      limit: 1,
      depth: 0,
      pagination: false,
      overrideAccess: true,
    })
    const data = {
      session: sessionId,
      player: playerId,
      parent: user.id,
      response: response as 'going' | 'not_going',
      respondedAt: new Date().toISOString(),
    }
    if (existing.docs[0]) {
      await payload.update({ collection: 'rsvps', id: existing.docs[0].id, data, overrideAccess: true })
    } else {
      await payload.create({ collection: 'rsvps', data, overrideAccess: true })
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[parent/rsvp]', err)
    return NextResponse.json({ ok: false }, { status: 500 })
  }
}
