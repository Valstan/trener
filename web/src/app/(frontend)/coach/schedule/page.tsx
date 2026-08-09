import config from '@payload-config'
import { headers as nextHeaders } from 'next/headers'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getPayload } from 'payload'
import React from 'react'

import type { Group } from '@/payload-types'
import { hasRole } from '@/access/roles'
import { loadOwnerBranch } from '@/lib/ownerBranch'
import { loadCoverage, type CoverageSummary } from '@/lib/coverage'
import { formatDateTime } from '@/lib/notifications/describe'
import { relId } from '@/lib/relId'

import { AppShell, COACH_TABS } from '../../components/AppShell'
import { BranchSwitcher } from '../../components/BranchSwitcher'
import { SessionComposer } from './SessionComposer'
import { SessionEditor } from './SessionEditor'

// Расписание тренера: компоновщик новой тренировки + его сессии (с inline-правкой/
// отменой — волна ядра M2) + сводка coverage по изменённым/отменённым.
// Доступ: персонал; читает scoped (тренер — только свои группы, #015).
export const dynamic = 'force-dynamic'

const STATUS: Record<string, { label: string; cls: string }> = {
  planned: { label: 'Запланирована', cls: 'badge' },
  changed: { label: 'Изменена', cls: 'badge badge-warn' },
  cancelled: { label: 'Отменена', cls: 'badge badge-danger' },
}

const CoachSchedulePage = async ({ searchParams }: { searchParams: Promise<{ past?: string }> }) => {
  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers: await nextHeaders() })
  if (!user) redirect('/login')
  if (!hasRole(user, 'owner', 'admin', 'coach')) redirect('/') // admin филиала — полноправный staff (M5)

  // Контекст филиала владельца (M5 PR-D): фильтр групп/сессий + селектор в шапке.
  const { branches, ctx, ctxGroupIds } = await loadOwnerBranch(payload, user)

  // По умолчанию — предстоящие (минус сутки: только что прошедшая тренировка ещё
  // нужна ради coverage). Раньше список шёл asc от начала времён с limit 100 —
  // прошедшие забивали экран, а свежесозданные занятия в него НЕ ПОПАДАЛИ вовсе.
  // ?past=1 — архив: прошедшие, свежие сверху.
  const { past } = await searchParams
  const showPast = past === '1'
  const cutoff = new Date(Date.now() - 24 * 3600_000).toISOString()
  const dateClause = showPast ? { startDate: { less_than: cutoff } } : { startDate: { greater_than: cutoff } }

  const sessions = await payload.find({
    collection: 'training-sessions',
    sort: showPast ? '-startDate' : 'startDate',
    limit: 100,
    pagination: false,
    where: ctxGroupIds ? { and: [{ group: { in: ctxGroupIds } }, dateClause] } : dateClause,
    user,
    overrideAccess: false,
  })

  // Группы пользователя (scoped) — селектор компоновщика + имена в карточках.
  const groups = (
    await payload.find({
      collection: 'groups',
      sort: 'name',
      limit: 200,
      depth: 0,
      pagination: false,
      where: ctx != null ? { branch: { equals: ctx } } : {},
      user,
      overrideAccess: false,
    })
  ).docs as Group[]
  const groupNameById = new Map(groups.map((g) => [g.id, g.name]))
  const groupOptions = groups.map((g) => ({ id: g.id, name: g.name }))

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
      {branches && <BranchSwitcher branches={branches} current={ctx} />}
      {groupOptions.length === 0 ? (
        <div className="empty-state">
          <span className="ic" aria-hidden>
            📅
          </span>
          У вас пока нет групп — тренировку добавить некому.
        </div>
      ) : (
        <SessionComposer groups={groupOptions} />
      )}

      <div className="row-between" style={{ alignItems: 'baseline' }}>
        <h2 className="section-title">{showPast ? 'Прошедшие тренировки' : 'Тренировки'}</h2>
        <Link className="small" href={showPast ? '/coach/schedule' : '/coach/schedule?past=1'}>
          {showPast ? '← к предстоящим' : 'прошедшие →'}
        </Link>
      </div>
      {sessions.docs.length === 0 ? (
        <div className="empty-state">
          <span className="ic" aria-hidden>
            📅
          </span>
          {showPast ? 'Прошедших тренировок нет.' : 'Тренировок пока нет.'}
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
                <SessionEditor
                  session={{
                    id: s.id,
                    startDate: s.startDate,
                    endDate: s.endDate,
                    location: s.location,
                    note: s.note,
                    status: s.status,
                  }}
                />
              </div>
            )
          })}
        </div>
      )}
    </AppShell>
  )
}

export default CoachSchedulePage
