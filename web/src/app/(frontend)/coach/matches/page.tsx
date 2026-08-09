import config from '@payload-config'
import { headers as nextHeaders } from 'next/headers'
import { redirect } from 'next/navigation'
import { getPayload } from 'payload'
import React from 'react'

import { hasRole } from '@/access/roles'
import { loadOwnerBranch } from '@/lib/ownerBranch'
import { resolveMatchViews, splitMatchViews } from '@/lib/matches'
import { relId } from '@/lib/relId'

import { AppShell, staffTabs } from '../../components/AppShell'
import { BranchSwitcher } from '../../components/BranchSwitcher'
import { MatchCard } from '../../components/MatchCard'
import { MatchComposer } from './MatchComposer'
import { ResultEntry } from './ResultEntry'

// Матчи тренера: компоновщик (результат или будущий матч, п.10) + «Предстоящие» с
// формой «внести результат» + лента сыгранных. Всё scoped (тренер — свои группы/дети,
// #015). Информационный канал — без coverage (F1).
export const dynamic = 'force-dynamic'

const CoachMatchesPage = async () => {
  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers: await nextHeaders() })
  if (!user) redirect('/login')
  if (!hasRole(user, 'owner', 'admin', 'coach')) redirect('/') // admin филиала — полноправный staff (M5)

  // Контекст филиала владельца (M5 PR-D).
  const { branches, ctx, ctxGroupIds } = await loadOwnerBranch(payload, user)

  // Группы тренера (scoped) — для селектора.
  const groups = await payload.find({
    collection: 'groups',
    sort: 'name',
    limit: 200,
    depth: 0,
    pagination: false,
    where: ctx != null ? { branch: { equals: ctx } } : {},
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

  // Матчи (scoped), свежие сверху; дележ на предстоящие/сыгранные — по счёту.
  const matches = await payload.find({
    collection: 'matches',
    sort: '-matchDate',
    limit: 50,
    depth: 0,
    pagination: false,
    where: ctxGroupIds ? { group: { in: ctxGroupIds } } : {},
    user,
    overrideAccess: false,
  })
  const views = await resolveMatchViews(payload, matches.docs)
  const { upcoming, played } = splitMatchViews(views)

  return (
    <AppShell title="Матчи" tabs={staffTabs(user)} active="matches">
      {branches && <BranchSwitcher branches={branches} current={ctx} />}
      {groupOptions.length === 0 ? (
        <div className="empty-state">
          <span className="ic" aria-hidden>
            🏆
          </span>
          У вас пока нет групп — матч добавить некому.
        </div>
      ) : (
        <MatchComposer groups={groupOptions} playersByGroup={playersByGroup} />
      )}

      {upcoming.length > 0 && (
        <>
          <h2 className="section-title">Предстоящие</h2>
          <div className="stack-sm">
            {upcoming.map((m) => (
              <div key={m.id} className="stack-xs">
                <MatchCard match={m} />
                <ResultEntry matchId={m.id} players={(m.groupId != null && playersByGroup[m.groupId]) || []} />
              </div>
            ))}
          </div>
        </>
      )}

      <h2 className="section-title">Сыгранные</h2>
      {played.length === 0 ? (
        <p className="muted">Результатов пока нет.</p>
      ) : (
        <div className="stack-sm">
          {played.map((m) => (
            <MatchCard key={m.id} match={m} />
          ))}
        </div>
      )}
    </AppShell>
  )
}

export default CoachMatchesPage
