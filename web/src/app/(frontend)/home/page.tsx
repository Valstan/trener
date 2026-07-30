import config from '@payload-config'
import type { Metadata } from 'next'
import { headers as nextHeaders } from 'next/headers'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getPayload } from 'payload'
import React from 'react'

import { isCoach, isOwner, isParent, isPending } from '@/access/roles'

import { AppShell, COACH_TABS, PARENT_TABS, type Tab } from '../components/AppShell'
import { SectionCards, sectionsForRoles } from '../components/SectionCards'

// Главная-карточки (M7, видение v2 §3): плашки-разделы по роли + баннер
// закреплённых объявлений владельца. Стартовые экраны ролей НЕ меняются
// (очередь «непринятых» — ров); сюда ведёт ⚽ в шапке.
export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Главная — Футбольная школа',
}

const HomeCardsPage = async () => {
  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers: await nextHeaders() })
  if (!user) redirect('/login')
  if (isPending(user)) redirect('/pending')

  const parentOnly = isParent(user) && !isCoach(user) && !isOwner(user)
  const tabs: Tab[] = parentOnly ? PARENT_TABS : COACH_TABS

  // Баннер: закреплённые объявления (scoped read сам ограничит видимость).
  const pinned = await payload.find({
    collection: 'announcements',
    where: { pinned: { equals: true } },
    sort: '-publishedAt',
    limit: 3,
    depth: 0,
    pagination: false,
    user,
    overrideAccess: false,
  })

  return (
    <AppShell title="Главная" tabs={tabs}>
      {pinned.docs.map((a) => (
        <article key={a.id} className="card card-accent stack-sm" style={{ marginBottom: '0.75rem' }}>
          <strong>📌 {a.title}</strong>
          <p className="pre" style={{ margin: 0 }}>
            {a.body}
          </p>
        </article>
      ))}
      <SectionCards sections={sectionsForRoles(user)} />
      {isOwner(user) && (
        <p className="note" style={{ marginTop: '1rem' }}>
          <Link href="/admin">Панель управления школой →</Link>
        </p>
      )}
    </AppShell>
  )
}

export default HomeCardsPage
