import config from '@payload-config'
import { headers as nextHeaders } from 'next/headers'
import { redirect } from 'next/navigation'
import { getPayload } from 'payload'
import React from 'react'

import type { Player, Rsvp, TrainingSession } from '@/payload-types'
import { isParent } from '@/access/roles'
import { describeChange } from '@/lib/notifications/describe'
import { relId } from '@/lib/relId'
import { rsvpKey } from '@/lib/rsvp'

import { AppShell, PARENT_TABS } from '../components/AppShell'
import { ParentInbox, type InboxItem } from './ParentInbox'
import { PushSubscribe } from './PushSubscribe'

// Вкладка «Изменения» родителя: очередь непринятых изменений расписания + подтверждение
// «вижу». Первичный in-app гарант доведения (kickoff §6) — не зависит от пуша.
//
// Доступ: только залогиненный родитель. Уведомления читаются СВОИ (scoped read,
// overrideAccess:false). Детали сессии (время/место + что изменилось) дотягиваются
// server-trusted (overrideAccess:true), т.к. служебные поля сессии field-locked на
// родителя (152-ФЗ); наружу уходит уже готовый текст (describeChange), не сырые поля.
export const dynamic = 'force-dynamic'

const ParentPage = async () => {
  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers: await nextHeaders() })
  if (!user) redirect('/login')
  if (!isParent(user)) redirect('/')

  const notifs = await payload.find({
    collection: 'notifications',
    where: { and: [{ parent: { equals: user.id } }, { status: { in: ['delivered', 'seen'] } }] },
    sort: '-changedAt',
    depth: 0,
    limit: 200,
    pagination: false,
    user,
    overrideAccess: false,
  })

  const sessionIds = [...new Set(notifs.docs.map((n) => relId(n.session)).filter((v): v is number => v != null))]
  const playerIds = [
    ...new Set(notifs.docs.flatMap((n) => ((n.players as (number | { id: number })[]) ?? []).map(relId)).filter((v): v is number => v != null)),
  ]

  const [sessions, players] = await Promise.all([
    sessionIds.length
      ? payload
          .find({
            collection: 'training-sessions',
            where: { id: { in: sessionIds } },
            depth: 0,
            pagination: false,
            overrideAccess: true,
          })
          .then((r) => r.docs)
      : Promise.resolve<TrainingSession[]>([]),
    playerIds.length
      ? payload
          .find({
            collection: 'players',
            where: { id: { in: playerIds } },
            depth: 0,
            pagination: false,
            overrideAccess: true,
          })
          .then((r) => r.docs)
      : Promise.resolve<Player[]>([]),
  ])

  // Существующие RSVP по (session × player) — чтобы подсветить текущий выбор.
  const rsvps: Rsvp[] =
    sessionIds.length && playerIds.length
      ? (
          await payload.find({
            collection: 'rsvps',
            where: { and: [{ session: { in: sessionIds } }, { player: { in: playerIds } }] },
            depth: 0,
            pagination: false,
            overrideAccess: true,
          })
        ).docs
      : []
  const rsvpByKey = new Map(rsvps.map((r) => [rsvpKey(relId(r.session) ?? -1, relId(r.player) ?? -1), r.response]))

  const sessionById = new Map(sessions.map((s) => [s.id, s]))
  const playerNameById = new Map(players.map((p) => [p.id, p.name]))

  const items: InboxItem[] = notifs.docs.map((n) => {
    const sessionId = relId(n.session) ?? -1
    const s = sessionById.get(sessionId)
    const desc = describeChange({
      type: n.type,
      startDate: s?.startDate ?? null,
      location: s?.location ?? null,
      prevStartDate: s?.prevStartDate ?? null,
      prevLocation: s?.prevLocation ?? null,
      changedFields: Array.isArray(s?.changedFields) ? (s.changedFields as string[]) : [],
    })
    const children = ((n.players as (number | { id: number })[]) ?? [])
      .map((p) => relId(p))
      .filter((id): id is number => id != null)
      .map((id) => ({
        id,
        name: playerNameById.get(id) ?? `#${id}`,
        rsvp: rsvpByKey.get(rsvpKey(sessionId, id)) ?? null,
      }))
    return { id: n.id, sessionId, type: n.type, status: n.status, title: desc.title, lines: desc.lines, children }
  })

  return (
    <AppShell title="Изменения" tabs={PARENT_TABS} active="changes">
      <p className="muted" style={{ margin: '0 0 1.25rem' }}>
        Отметьте «Вижу», чтобы тренер знал, что вы в курсе.
      </p>
      <div style={{ marginBottom: '1.25rem' }}>
        <PushSubscribe />
      </div>
      <ParentInbox items={items} />
    </AppShell>
  )
}

export default ParentPage
