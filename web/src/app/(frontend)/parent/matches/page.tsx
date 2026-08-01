import config from '@payload-config'
import { headers as nextHeaders } from 'next/headers'
import { redirect } from 'next/navigation'
import { getPayload } from 'payload'
import React from 'react'

import { isParent, isPending } from '@/access/roles'
import { resolveMatchViews, splitMatchViews } from '@/lib/matches'

import { AppShell, PARENT_TABS } from '../../components/AppShell'
import { MatchCard } from '../../components/MatchCard'

// Вкладка «Матчи» родителя: ближайшие игры групп его детей (видение §3.1 — когда, во
// сколько, где) + результаты сыгранных (scoped read; вне coverage — F1). 152-ФЗ: имена
// авторов голов разрешаются overrideAccess (см. resolveMatchViews) — публикация
// спортивного результата команды.
export const dynamic = 'force-dynamic'

const ParentMatchesPage = async () => {
  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers: await nextHeaders() })
  if (!user) redirect('/login')
  if (isPending(user)) redirect('/pending')
  if (!isParent(user)) redirect('/')

  const matches = await payload.find({
    collection: 'matches',
    sort: '-matchDate',
    limit: 30,
    depth: 0,
    pagination: false,
    user,
    overrideAccess: false,
  })
  const views = await resolveMatchViews(payload, matches.docs)
  const { upcoming, played } = splitMatchViews(views)

  return (
    <AppShell title="Матчи" tabs={PARENT_TABS} active="matches">
      {views.length === 0 ? (
        <div className="empty-state">
          <span className="ic" aria-hidden>
            🏆
          </span>
          Матчей пока нет.
        </div>
      ) : (
        <>
          {upcoming.length > 0 && (
            <>
              <h2 className="section-title">Ближайшие</h2>
              <div className="stack-sm">
                {upcoming.map((m) => (
                  <MatchCard key={m.id} match={m} />
                ))}
              </div>
            </>
          )}
          {played.length > 0 && (
            <>
              <h2 className="section-title">Результаты</h2>
              <div className="stack-sm">
                {played.map((m) => (
                  <MatchCard key={m.id} match={m} />
                ))}
              </div>
            </>
          )}
        </>
      )}
    </AppShell>
  )
}

export default ParentMatchesPage
