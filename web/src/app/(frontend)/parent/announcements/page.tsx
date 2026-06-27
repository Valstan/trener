import config from '@payload-config'
import { headers as nextHeaders } from 'next/headers'
import { redirect } from 'next/navigation'
import { getPayload } from 'payload'
import React from 'react'

import type { Group } from '@/payload-types'
import { isParent } from '@/access/roles'
import { relId } from '@/lib/relId'

import { AppShell, PARENT_TABS } from '../../components/AppShell'
import { AnnouncementsFeed, type FeedItem } from '../AnnouncementsFeed'

// Вкладка «Объявления» родителя: лента объявлений групп его детей (scoped read; вне
// coverage — F1). Свежие сверху; «новое» отмечается клиентски по last-seen (см. feed).
export const dynamic = 'force-dynamic'

const ParentAnnouncementsPage = async () => {
  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers: await nextHeaders() })
  if (!user) redirect('/login')
  if (!isParent(user)) redirect('/')

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
    <AppShell title="Объявления" tabs={PARENT_TABS} active="announcements">
      {feedItems.length === 0 ? (
        <div className="empty-state">
          <span className="ic" aria-hidden>
            📣
          </span>
          Объявлений пока нет.
        </div>
      ) : (
        <AnnouncementsFeed items={feedItems} />
      )}
    </AppShell>
  )
}

export default ParentAnnouncementsPage
