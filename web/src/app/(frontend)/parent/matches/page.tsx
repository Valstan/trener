import config from '@payload-config'
import { headers as nextHeaders } from 'next/headers'
import { redirect } from 'next/navigation'
import { getPayload } from 'payload'
import React from 'react'

import { isParent } from '@/access/roles'
import { resolveMatchViews } from '@/lib/matches'

import { AppShell, PARENT_TABS } from '../../components/AppShell'
import { MatchCard } from '../../components/MatchCard'

// Вкладка «Результаты» родителя: лента результатов групп его детей (scoped read; вне
// coverage — F1). Свежие сверху. 152-ФЗ: имена авторов голов разрешаются overrideAccess
// (см. resolveMatchViews) — публикация спортивного результата команды.
export const dynamic = 'force-dynamic'

const ParentMatchesPage = async () => {
  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers: await nextHeaders() })
  if (!user) redirect('/login')
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

  return (
    <AppShell title="Результаты" tabs={PARENT_TABS} active="matches">
      {views.length === 0 ? (
        <div className="empty-state">
          <span className="ic" aria-hidden>
            🏆
          </span>
          Результатов матчей пока нет.
        </div>
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

export default ParentMatchesPage
