import config from '@payload-config'
import { headers as nextHeaders } from 'next/headers'
import { redirect } from 'next/navigation'
import { getPayload } from 'payload'
import React from 'react'

import type { Group, Player, Rsvp, TrainingSession } from '@/payload-types'
import { isParent } from '@/access/roles'
import { describeChange } from '@/lib/notifications/describe'
import { relId } from '@/lib/relId'
import { rsvpKey } from '@/lib/rsvp'

import { AnnouncementsFeed, type FeedItem } from './AnnouncementsFeed'
import { ParentInbox, type InboxItem } from './ParentInbox'
import { PushSubscribe } from './PushSubscribe'

// Экран родителя: очередь непринятых изменений расписания + подтверждение «вижу».
// Первичный in-app гарант доведения (kickoff §6) — не зависит от пуша.
//
// Доступ: только залогиненный родитель. Уведомления читаются СВОИ (scoped read,
// overrideAccess:false). Детали сессии (время/место + что изменилось) дотягиваются
// server-trusted (overrideAccess:true), т.к. служебные поля сессии field-locked на
// родителя (152-ФЗ); наружу уходит уже готовый текст (describeChange), не сырые поля.
export const dynamic = 'force-dynamic'

const container: React.CSSProperties = {
  maxWidth: 560,
  margin: '0 auto',
  padding: '2.5rem 1.25rem 4rem',
  minHeight: '100vh',
}

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

  // Лента объявлений (scoped read — родитель видит группы своих детей; F1: вне coverage).
  const announcements = await payload.find({
    collection: 'announcements',
    sort: '-publishedAt',
    limit: 20,
    depth: 0,
    pagination: false,
    user,
    overrideAccess: false,
  })
  const annGroupIds = [...new Set(announcements.docs.map((a) => relId(a.group)).filter((v): v is number => v != null))]
  const annGroups: Group[] = annGroupIds.length
    ? (
        await payload.find({
          collection: 'groups',
          where: { id: { in: annGroupIds } },
          depth: 0,
          pagination: false,
          overrideAccess: true,
        })
      ).docs
    : []
  const annGroupNameById = new Map(annGroups.map((g) => [g.id, g.name]))
  const feedItems: FeedItem[] = announcements.docs.map((a) => ({
    id: a.id,
    title: a.title,
    body: a.body,
    groupName: annGroupNameById.get(relId(a.group) ?? -1) ?? null,
    publishedAt: a.publishedAt ?? null,
  }))

  return (
    <main style={container}>
      <h1 style={{ fontSize: '1.4rem', margin: '0 0 0.25rem' }}>Изменения в расписании</h1>
      <p style={{ color: 'var(--muted)', margin: '0 0 1.25rem' }}>
        Отметьте «Вижу», чтобы тренер знал, что вы в курсе.
      </p>
      <div style={{ marginBottom: '1.25rem' }}>
        <PushSubscribe />
      </div>
      <ParentInbox items={items} />
      <AnnouncementsFeed items={feedItems} />
    </main>
  )
}

export default ParentPage
