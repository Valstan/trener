'use client'

import React, { useCallback, useEffect, useState } from 'react'

import type { CoverageResult } from '@/lib/coverage'

type Change = { title: string; lines: string[] } | null

const box: React.CSSProperties = {
  padding: '1rem 1.1rem',
  borderRadius: 10,
  border: '1px solid #1f3a2c',
  background: '#11261c',
  display: 'grid',
  gap: '0.5rem',
}

const row = (cold: boolean): React.CSSProperties => ({
  display: 'flex',
  justifyContent: 'space-between',
  gap: '0.75rem',
  padding: '0.5rem 0.7rem',
  borderRadius: 8,
  background: cold ? '#2a1c14' : '#15281d',
  fontSize: '0.95rem',
})

// Coverage «N из M» с лайв-опросом (тренер смотрит, как капают подтверждения).
export const CoverageView = ({
  sessionId,
  status,
  change,
  initial,
}: {
  sessionId: number
  status: string
  change: Change
  initial: CoverageResult
}) => {
  const [cov, setCov] = useState<CoverageResult>(initial)
  const [refreshing, setRefreshing] = useState(false)

  const refresh = useCallback(async () => {
    setRefreshing(true)
    try {
      const res = await fetch(`/coach/coverage?sessionId=${sessionId}`)
      const data = (await res.json()) as { ok?: boolean } & CoverageResult
      if (res.ok && data.ok) setCov({ wave: data.wave, summary: data.summary, unreachable: data.unreachable })
    } catch {
      // молча — оставляем прежние данные
    }
    setRefreshing(false)
  }, [sessionId])

  // Лайв-обновление, пока есть волна (нечего опрашивать у planned-сессии).
  useEffect(() => {
    if (!cov.wave) return
    const t = setInterval(refresh, 15000)
    return () => clearInterval(t)
  }, [cov.wave, refresh])

  if (!cov.wave) {
    return (
      <div style={box}>
        <strong style={{ fontSize: '1.1rem' }}>Подтверждать нечего</strong>
        <span style={{ color: 'var(--muted)' }}>Сессия запланирована и не менялась — уведомлений не было.</span>
      </div>
    )
  }

  const { summary, unreachable } = cov
  const pct = summary.total ? Math.round((100 * summary.acked) / summary.total) : 0
  const allDone = summary.total > 0 && summary.acked === summary.total

  return (
    <div style={{ display: 'grid', gap: '1rem' }}>
      <h1 style={{ fontSize: '1.4rem', margin: 0 }}>
        {status === 'cancelled' ? 'Отмена тренировки' : 'Изменение тренировки'}
      </h1>
      {change && (
        <div style={box}>
          <strong>{change.title}</strong>
          <ul style={{ margin: 0, paddingLeft: '1.1rem' }}>
            {change.lines.map((l, i) => (
              <li key={i}>{l}</li>
            ))}
          </ul>
        </div>
      )}

      <div style={{ ...box, background: allDone ? '#0e2e1c' : '#11261c', border: `1px solid ${allDone ? '#2c7a4b' : '#1f3a2c'}` }}>
        <div style={{ fontSize: '1.6rem', fontWeight: 700 }}>
          Приняли {summary.acked} из {summary.total}
          {allDone ? ' ✅' : ''}
        </div>
        <div style={{ height: 8, borderRadius: 4, background: '#0a1812', overflow: 'hidden' }}>
          <div style={{ width: `${pct}%`, height: '100%', background: 'var(--accent)' }} />
        </div>
        <div style={{ color: 'var(--muted)', fontSize: '0.85rem' }}>
          {summary.seen} открыли без подтверждения · {summary.delivered} не открывали{' '}
          <button
            type="button"
            onClick={refresh}
            disabled={refreshing}
            style={{ marginLeft: '0.5rem', background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', padding: 0 }}
          >
            {refreshing ? 'обновляю…' : '↻ обновить'}
          </button>
        </div>
      </div>

      {unreachable > 0 && (
        <div style={{ ...box, background: '#2a1c14', border: '1px solid #5a3a1f' }}>
          <strong>⚠️ Недостижимы: {unreachable}</strong>
          <span style={{ color: 'var(--muted)', fontSize: '0.9rem' }}>
            детей в группе без привязанного аккаунта родителя — уведомление до них не дошло. Заведите
            родителя через приглашение, иначе он узнает об изменении только при заходе.
          </span>
        </div>
      )}

      {summary.pending.length > 0 ? (
        <div style={{ display: 'grid', gap: '0.4rem' }}>
          <strong>Не подтвердили — напомните:</strong>
          {summary.pending.map((e) => (
            <div key={e.parentId} style={row(e.status === 'delivered')}>
              <span>
                {e.parentName}
                {e.childNames.length > 0 && (
                  <span style={{ color: 'var(--muted)' }}> · {e.childNames.join(', ')}</span>
                )}
              </span>
              <span style={{ color: 'var(--muted)', whiteSpace: 'nowrap' }}>
                {e.status === 'delivered' ? 'не открыл' : 'открыл, молчит'}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <p style={{ color: 'var(--accent)' }}>Все подтвердили — отлично.</p>
      )}
    </div>
  )
}
