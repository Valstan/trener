import config from '@payload-config'
import { headers as nextHeaders } from 'next/headers'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getPayload } from 'payload'
import React from 'react'

import type { Group } from '@/payload-types'
import { isAdmin, isCoach } from '@/access/roles'
import { loadCoverage, type CoverageSummary } from '@/lib/coverage'
import { formatDateTime } from '@/lib/notifications/describe'
import { relId } from '@/lib/relId'

import { AppShell, COACH_TABS } from '../../components/AppShell'

// Расписание тренера: его сессии + сводка coverage по изменённым/отменённым.
// Доступ: персонал; читает scoped (тренер — только свои группы, #015).
export const dynamic = 'force-dynamic'

const STATUS: Record<string, { label: string; cls: string }> = {
  planned: { label: 'Запланирована', cls: 'badge' },
  changed: { label: 'Изменена', cls: 'badge badge-warn' },
  cancelled: { label: 'Отменена', cls: 'badge badge-danger' },
}

const CoachSchedulePage = async () => {
  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers: await nextHeaders() })
  if (!user) redirect('/login')
  if (!(isCoach(user) || isAdmin(user))) redirect('/')

  const sessions = await payload.find({
    collection: 'training-sessions',
    sort: 'startDate',
    limit: 100,
    pagination: false,
    user,
    overrideAccess: false,
  })

  const groupIds = [...new Set(sessions.docs.map((s) => relId(s.group)).filter((v): v is number => v != null))]
  const groups = groupIds.length
    ? (
        await payload.find({
          collection: 'groups',
          where: { id: { in: groupIds } },
          depth: 0,
          pagination: false,
          overrideAccess: true,
        })
      ).docs
    : ([] as Group[])
  const groupNameById = new Map(groups.map((g) => [g.id, g.name]))

  // Coverage только для сессий с волной (изменённых/отменённых).
  const summaryBySession = new Map<number, CoverageSummary>()
  await Promise.all(
    sessions.docs
      .filter((s) => s.changedAt)
      .map(async (s) => {
        const c = await loadCoverage(payload, s)
        summaryBySession.set(s.id, c.summary)
      }),
  )

  return (
    <AppShell title="Расписание" tabs={COACH_TABS} active="schedule">
      {sessions.docs.length === 0 ? (
        <div className="empty-state">
          <span className="ic" aria-hidden>
            📅
          </span>
          Тренировок пока нет.
        </div>
      ) : (
        <div className="stack-sm">
          {sessions.docs.map((s) => {
            const summary = summaryBySession.get(s.id)
            const changed = s.status !== 'planned'
            const st = STATUS[s.status] ?? { label: s.status, cls: 'badge' }
            return (
              <div key={s.id} className={changed ? 'card card-accent stack-sm' : 'card stack-sm'}>
                <div className="row-between">
                  <strong>{formatDateTime(s.startDate)}</strong>
                  <span className={st.cls}>{st.label}</span>
                </div>
                <div className="muted small">
                  {groupNameById.get(relId(s.group) ?? -1) ?? 'Группа'}
                  {s.location ? ` · ${s.location}` : ''}
                </div>
                {changed && summary && (
                  <div style={{ fontSize: '0.95rem' }}>
                    Приняли{' '}
                    <strong style={{ color: summary.acked === summary.total ? 'var(--accent)' : 'var(--fg)' }}>
                      {summary.acked} из {summary.total}
                    </strong>{' '}
                    · <Link href={`/coach/session/${s.id}`}>подробнее →</Link>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </AppShell>
  )
}

export default CoachSchedulePage
