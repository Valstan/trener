import config from '@payload-config'
import { getPayload } from 'payload'
import { NextResponse } from 'next/server'

import { buildRsvpReminderMessage } from '@/lib/push/message'
import { sendPushToUser } from '@/lib/push/send'
import { relId } from '@/lib/relId'
import { rsvpKey, selectReminderParents, type PlayerSlot } from '@/lib/rsvp'

// Cron: напоминание RSVP-нереспондентам по ближайшим тренировкам (окно 48ч).
// H3: ТОЛЬКО RSVP-нереспонденты — НЕ ack-эскалация (она вне M2, её закрывает
// coverage-экран: тренер сам звонит). Best-effort пуш (in-app очередь первична).
//
// Секрет-гард (#008/#011): CRON_SECRET в env; вызов с ?secret= или заголовком
// x-cron-secret. Нет CRON_SECRET → эндпоинт ОТКЛЮЧЁН (403), чтобы его нельзя было
// дёрнуть открыто. На проде дёргается systemd-таймером/cron'ом с секретом.
export const dynamic = 'force-dynamic'

const WINDOW_MS = 48 * 60 * 60 * 1000

const handle = async (req: Request): Promise<Response> => {
  const secret = process.env.CRON_SECRET
  if (!secret) return NextResponse.json({ ok: false, reason: 'disabled' }, { status: 403 })
  const provided = new URL(req.url).searchParams.get('secret') ?? req.headers.get('x-cron-secret')
  if (provided !== secret) return NextResponse.json({ ok: false }, { status: 401 })

  try {
    const payload = await getPayload({ config })
    const now = Date.now()
    const upcoming = await payload.find({
      collection: 'training-sessions',
      where: {
        and: [
          { startDate: { greater_than: new Date(now).toISOString() } },
          { startDate: { less_than: new Date(now + WINDOW_MS).toISOString() } },
          { status: { not_equals: 'cancelled' } },
        ],
      },
      depth: 0,
      pagination: false,
      limit: 500,
      overrideAccess: true,
    })

    if (!upcoming.docs.length) return NextResponse.json({ ok: true, sessions: 0, reminders: 0 })

    const sessionIds = upcoming.docs.map((s) => s.id)
    const groupIds = [...new Set(upcoming.docs.map((s) => relId(s.group)).filter((v): v is number => v != null))]

    // дети предстоящих групп → слоты (session × player × parent)
    const players = groupIds.length
      ? (
          await payload.find({
            collection: 'players',
            where: { group: { in: groupIds } },
            depth: 0,
            pagination: false,
            limit: 5000,
            overrideAccess: true,
          })
        ).docs
      : []
    const playersByGroup = new Map<number, typeof players>()
    for (const p of players) {
      const g = relId(p.group)
      if (g == null) continue
      const list = playersByGroup.get(g) ?? []
      list.push(p)
      playersByGroup.set(g, list)
    }
    const slots: PlayerSlot[] = []
    for (const s of upcoming.docs) {
      const g = relId(s.group)
      for (const p of (g != null && playersByGroup.get(g)) || []) {
        slots.push({ sessionId: s.id, playerId: p.id, parentId: relId(p.parent) })
      }
    }

    // уже ответившие (session × player)
    const rsvps = await payload.find({
      collection: 'rsvps',
      where: { session: { in: sessionIds } },
      depth: 0,
      pagination: false,
      limit: 5000,
      overrideAccess: true,
    })
    const responded = new Set(
      rsvps.docs.map((r) => rsvpKey(relId(r.session) ?? -1, relId(r.player) ?? -1)),
    )

    const targets = selectReminderParents(slots, responded)
    const message = buildRsvpReminderMessage()
    let reminders = 0
    for (const parentId of targets) {
      const result = await sendPushToUser(payload, parentId, message)
      if (result === 'ok') reminders++
    }

    payload.logger.info(`[cron/rsvp] sessions=${upcoming.docs.length} targets=${targets.length} sent=${reminders}`)
    return NextResponse.json({ ok: true, sessions: upcoming.docs.length, targets: targets.length, reminders })
  } catch (err) {
    console.error('[cron/rsvp-reminders]', err)
    return NextResponse.json({ ok: false }, { status: 500 })
  }
}

export const GET = handle
export const POST = handle
