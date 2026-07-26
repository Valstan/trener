import config from '@payload-config'
import { headers as nextHeaders } from 'next/headers'
import { redirect } from 'next/navigation'
import { getPayload } from 'payload'
import React from 'react'

import { isOwner, isCoach } from '@/access/roles'
import { loadOwnerBranch } from '@/lib/ownerBranch'
import { formatDateTime } from '@/lib/notifications/describe'
import { relId } from '@/lib/relId'

import { AppShell, COACH_TABS } from '../../components/AppShell'
import { BranchSwitcher } from '../../components/BranchSwitcher'
import { AnnouncementComposer } from './AnnouncementComposer'

// Объявления тренера: компоновщик (выбор группы + текст + флаг пуша) + список своих
// прошлых объявлений. Доступ: персонал; всё читается scoped (тренер — свои группы, #015).
export const dynamic = 'force-dynamic'

const CoachAnnouncementsPage = async () => {
  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers: await nextHeaders() })
  if (!user) redirect('/login')
  if (!(isCoach(user) || isOwner(user))) redirect('/')

  // Контекст филиала владельца (M5 PR-D).
  const { branches: ctxBranches, ctx, ctxGroupIds } = await loadOwnerBranch(payload, user)

  // Группы тренера (scoped read) — для селектора адресата.
  const groups = await payload.find({
    collection: 'groups',
    sort: 'name',
    limit: 200,
    pagination: false,
    where: ctx != null ? { branch: { equals: ctx } } : {},
    user,
    overrideAccess: false,
  })
  const groupOptions = groups.docs.map((g) => ({ id: g.id, name: g.name }))

  // M5 PR-C: владельцу — список филиалов для охвата branch/network.
  const branchOptions = isOwner(user)
    ? (
        await payload.find({
          collection: 'branches',
          sort: 'name',
          limit: 200,
          pagination: false,
          overrideAccess: true,
        })
      ).docs.map((b) => ({ id: b.id, name: b.name }))
    : null

  // Прошлые объявления (scoped read), свежие сверху. В контексте филиала —
  // его группы + сетевые/филиальные.
  const announcements = await payload.find({
    collection: 'announcements',
    sort: '-publishedAt',
    limit: 50,
    depth: 0,
    pagination: false,
    where: ctxGroupIds
      ? { or: [{ scope: { not_equals: 'group' } }, { group: { in: ctxGroupIds } }] }
      : {},
    user,
    overrideAccess: false,
  })
  const groupNameById = new Map(groupOptions.map((g) => [g.id, g.name]))

  return (
    <AppShell title="Объявления" tabs={COACH_TABS} active="announcements">
      {ctxBranches && <BranchSwitcher branches={ctxBranches} current={ctx} />}
      {groupOptions.length === 0 && !branchOptions ? (
        <div className="empty-state">
          <span className="ic" aria-hidden>
            📣
          </span>
          У вас пока нет групп — объявление отправить некому.
        </div>
      ) : (
        <AnnouncementComposer groups={groupOptions} branches={branchOptions} />
      )}

      <h2 className="section-title">Отправленные</h2>
      {announcements.docs.length === 0 ? (
        <p className="muted">Объявлений пока нет.</p>
      ) : (
        <div className="stack-sm">
          {announcements.docs.map((a) => (
            <article key={a.id} className="card stack-sm">
              <div className="row-between" style={{ alignItems: 'baseline' }}>
                <strong>{a.title}</strong>
                <span className="muted small" style={{ whiteSpace: 'nowrap' }}>
                  {a.publishedAt ? formatDateTime(a.publishedAt) : ''}
                </span>
              </div>
              <div className="muted small">
                {a.scope === 'network'
                  ? '🌐 Вся сеть'
                  : a.scope === 'branch'
                    ? '🏢 Филиалы'
                    : (groupNameById.get(relId(a.group) ?? -1) ?? 'Группа')}
                {a.pinned ? ' · 📌 закреплено' : ''}
                {a.triggersPush ? ' · 🔔 с пушем' : ''}
              </div>
              <p className="pre">{a.body}</p>
            </article>
          ))}
        </div>
      )}
    </AppShell>
  )
}

export default CoachAnnouncementsPage
