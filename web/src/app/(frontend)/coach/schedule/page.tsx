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

// Расписание тренера: его сессии + сводка coverage по изменённым/отменённым.
// Доступ: персонал; читает scoped (тренер — только свои группы, #015).
export const dynamic = 'force-dynamic'

const container: React.CSSProperties = {
  maxWidth: 640,
  margin: '0 auto',
  padding: '2.5rem 1.25rem 4rem',
  minHeight: '100vh',
}

const STATUS_LABEL: Record<string, string> = {
  planned: 'Запланирована',
  changed: 'Изменена',
  cancelled: 'Отменена',
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
    <main style={container}>
      <h1 style={{ fontSize: '1.4rem', margin: '0 0 1.25rem' }}>Расписание</h1>
      {sessions.docs.length === 0 ? (
        <p style={{ color: 'var(--muted)' }}>Тренировок пока нет.</p>
      ) : (
        <div style={{ display: 'grid', gap: '0.6rem' }}>
          {sessions.docs.map((s) => {
            const summary = summaryBySession.get(s.id)
            const changed = s.status !== 'planned'
            return (
              <div
                key={s.id}
                style={{
                  padding: '0.85rem 1rem',
                  borderRadius: 10,
                  border: `1px solid ${changed ? '#2c7a4b' : '#1f3a2c'}`,
                  background: '#11261c',
                  display: 'grid',
                  gap: '0.3rem',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem' }}>
                  <strong>{formatDateTime(s.startDate)}</strong>
                  <span style={{ color: 'var(--muted)', fontSize: '0.85rem' }}>{STATUS_LABEL[s.status] ?? s.status}</span>
                </div>
                <div style={{ color: 'var(--muted)', fontSize: '0.9rem' }}>
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
    </main>
  )
}

export default CoachSchedulePage
