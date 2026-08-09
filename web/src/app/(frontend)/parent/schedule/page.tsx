import config from '@payload-config'
import { headers as nextHeaders } from 'next/headers'
import { redirect } from 'next/navigation'
import { getPayload } from 'payload'
import React from 'react'

import { isParent, isPending } from '@/access/roles'
import { formatDateTime } from '@/lib/notifications/describe'
import { relId } from '@/lib/relId'
import { rsvpKey } from '@/lib/rsvp'

import { AppShell, PARENT_TABS } from '../../components/AppShell'
import { RsvpButtons } from './RsvpButtons'

// Расписание родителя: предстоящие тренировки групп его детей + RSVP-кнопки на
// каждой карточке. До 09.08 такого экрана НЕ БЫЛО: родитель видел только очередь
// изменений, список тренировок был недостижим, а cron-пуш «подтвердите участие»
// вёл на экран, где ответить нечем (кнопки жили только в карточке изменения).
//
// Читаем scoped (overrideAccess:false) — readSessions сам ограничит группами детей.
export const dynamic = 'force-dynamic'

const STATUS: Record<string, { label: string; cls: string }> = {
  changed: { label: 'Изменена', cls: 'badge badge-warn' },
  cancelled: { label: 'Отменена', cls: 'badge badge-danger' },
}

const ParentSchedulePage = async () => {
  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers: await nextHeaders() })
  if (!user) redirect('/login')
  if (isPending(user)) redirect('/pending')
  if (!isParent(user)) redirect('/')

  // Дети этого родителя (для RSVP-кнопок и фильтра «эта тренировка — про моего ребёнка»).
  const players = await payload.find({
    collection: 'players',
    where: { parent: { equals: user.id } },
    depth: 0,
    limit: 100,
    pagination: false,
    overrideAccess: true,
  })
  const myPlayers = players.docs.filter((p) => relId(p.group) != null)
  const playersByGroup = new Map<number, { id: number; name: string }[]>()
  for (const p of myPlayers) {
    const g = relId(p.group)
    if (g == null) continue
    const list = playersByGroup.get(g) ?? []
    list.push({ id: p.id, name: p.name })
    playersByGroup.set(g, list)
  }

  // Предстоящие (и идущие прямо сейчас: −2 ч) тренировки — scoped read.
  const since = new Date(Date.now() - 2 * 3600_000).toISOString()
  const sessions = await payload.find({
    collection: 'training-sessions',
    where: { startDate: { greater_than: since } },
    sort: 'startDate',
    limit: 100,
    depth: 0,
    pagination: false,
    user,
    overrideAccess: false,
  })

  // Текущие RSVP-ответы по (session × мой ребёнок).
  const sessionIds = sessions.docs.map((s) => s.id)
  const myPlayerIds = myPlayers.map((p) => p.id)
  const rsvps =
    sessionIds.length && myPlayerIds.length
      ? await payload.find({
          collection: 'rsvps',
          where: { and: [{ session: { in: sessionIds } }, { player: { in: myPlayerIds } }] },
          depth: 0,
          limit: 1000,
          pagination: false,
          overrideAccess: true,
        })
      : { docs: [] }
  const rsvpByKey = new Map(
    rsvps.docs.map((r) => [rsvpKey(relId(r.session) ?? -1, relId(r.player) ?? -1), r.response]),
  )

  // Имена групп — служебное чтение (родителю нужен только ярлык).
  const groupIds = [...new Set(sessions.docs.map((s) => relId(s.group)).filter((v): v is number => v != null))]
  const groups = groupIds.length
    ? await payload.find({ collection: 'groups', where: { id: { in: groupIds } }, depth: 0, pagination: false, overrideAccess: true })
    : { docs: [] }
  const groupNameById = new Map(groups.docs.map((g) => [g.id, g.name]))

  return (
    <AppShell title="Расписание" tabs={PARENT_TABS} active="schedule">
      {myPlayers.length === 0 ? (
        <div className="empty-state">
          <span className="ic" aria-hidden>
            📅
          </span>
          К вам пока не привязан ребёнок с группой — расписание появится после
          подтверждения ребёнка и назначения группы тренером.
        </div>
      ) : sessions.docs.length === 0 ? (
        <div className="empty-state">
          <span className="ic" aria-hidden>
            📅
          </span>
          Ближайших тренировок пока нет — тренер ещё не добавил расписание.
        </div>
      ) : (
        <div className="stack-sm">
          {sessions.docs.map((s) => {
            const st = STATUS[s.status]
            const g = relId(s.group)
            const childRows = ((g != null && playersByGroup.get(g)) || []).map((c) => ({
              ...c,
              rsvp: rsvpByKey.get(rsvpKey(s.id, c.id)) ?? null,
            }))
            return (
              <div key={s.id} className="card stack-sm">
                <div className="row-between">
                  <strong>{formatDateTime(s.startDate)}</strong>
                  {st && <span className={st.cls}>{st.label}</span>}
                </div>
                <div className="muted small">
                  {groupNameById.get(g ?? -1) ?? 'Группа'}
                  {s.location ? ` · ${s.location}` : ''}
                </div>
                {s.note && <p className="pre muted small" style={{ margin: 0 }}>{s.note}</p>}
                {s.status !== 'cancelled' && <RsvpButtons sessionId={s.id} childRows={childRows} />}
              </div>
            )
          })}
        </div>
      )}
    </AppShell>
  )
}

export default ParentSchedulePage
