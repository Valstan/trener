import config from '@payload-config'
import { headers as nextHeaders } from 'next/headers'
import { redirect } from 'next/navigation'
import { getPayload } from 'payload'
import React from 'react'

import { isAdmin, isCoach } from '@/access/roles'
import { resolveMatchViews } from '@/lib/matches'
import { relId } from '@/lib/relId'

import { AppShell, COACH_TABS } from '../../components/AppShell'
import { MatchCard } from '../../components/MatchCard'
import { MatchComposer } from './MatchComposer'

// Результаты матчей тренера: компоновщик (группа + счёт + авторы голов) + лента прошлых
// результатов. Всё scoped (тренер — свои группы/дети, #015). Информационный канал —
// без coverage (F1).
export const dynamic = 'force-dynamic'

const CoachMatchesPage = async () => {
  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers: await nextHeaders() })
  if (!user) redirect('/login')
  if (!(isCoach(user) || isAdmin(user))) redirect('/')

  // Группы тренера (scoped) — для селектора.
  const groups = await payload.find({
    collection: 'groups',
    sort: 'name',
    limit: 200,
    depth: 0,
    pagination: false,
    user,
    overrideAccess: false,
  })
  const groupOptions = groups.docs.map((g) => ({ id: g.id, name: g.name }))

  // Дети групп тренера (scoped) → сгруппировать по group для пикера авторов голов.
  const players = await payload.find({
    collection: 'players',
    sort: 'name',
    limit: 1000,
    depth: 0,
    pagination: false,
    user,
    overrideAccess: false,
  })
  const playersByGroup: Record<number, { id: number; name: string }[]> = {}
  for (const p of players.docs) {
    const gid = relId(p.group)
    if (gid == null) continue
    ;(playersByGroup[gid] ??= []).push({ id: p.id, name: p.name })
  }

  // Прошлые результаты (scoped), свежие сверху.
  const matches = await payload.find({
    collection: 'matches',
    sort: '-matchDate',
    limit: 50,
    depth: 0,
    pagination: false,
    user,
    overrideAccess: false,
  })
  const views = await resolveMatchViews(payload, matches.docs)

  return (
    <AppShell title="Результаты" tabs={COACH_TABS} active="matches">
      {groupOptions.length === 0 ? (
        <div className="empty-state">
          <span className="ic" aria-hidden>
            🏆
          </span>
          У вас пока нет групп — результат добавить некому.
        </div>
      ) : (
        <MatchComposer groups={groupOptions} playersByGroup={playersByGroup} />
      )}

      <h2 className="section-title">Добавленные</h2>
      {views.length === 0 ? (
        <p className="muted">Результатов пока нет.</p>
      ) : (
        <div className="stack-sm">
          {views.map((m) => (
            <MatchCard key={m.id} match={m} />
          ))}
        </div>
      )}
    </AppShell>
  )
}

export default CoachMatchesPage
