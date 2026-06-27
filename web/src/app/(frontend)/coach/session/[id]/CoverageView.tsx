'use client'

import React, { useCallback, useEffect, useState } from 'react'

import type { CoverageResult } from '@/lib/coverage'

type Change = { title: string; lines: string[] } | null

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
      if (res.ok && data.ok)
        setCov({ wave: data.wave, summary: data.summary, unreachable: data.unreachable, rsvp: data.rsvp })
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
      <div className="card stack-sm">
        <strong style={{ fontSize: '1.1rem' }}>Подтверждать нечего</strong>
        <span className="muted">Сессия запланирована и не менялась — уведомлений не было.</span>
      </div>
    )
  }

  const { summary, unreachable, rsvp } = cov
  const pct = summary.total ? Math.round((100 * summary.acked) / summary.total) : 0
  const allDone = summary.total > 0 && summary.acked === summary.total

  return (
    <div className="stack">
      <h1 className="page-title" style={{ marginBottom: 0 }}>
        {status === 'cancelled' ? 'Отмена тренировки' : 'Изменение тренировки'}
      </h1>
      {change && (
        <div className="card stack-sm">
          <strong>{change.title}</strong>
          <ul className="list-reset">
            {change.lines.map((l, i) => (
              <li key={i}>{l}</li>
            ))}
          </ul>
        </div>
      )}

      <div className={allDone ? 'card card-accent stack-sm' : 'card stack-sm'}>
        <div className="big-stat">
          Приняли {summary.acked} из {summary.total}
          {allDone ? ' ✅' : ''}
        </div>
        <div className="progress">
          <i style={{ width: `${pct}%` }} />
        </div>
        <div className="muted small">
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

      <div className="card stack-sm">
        <strong>Придут на тренировку</strong>
        <div style={{ display: 'flex', gap: '1.25rem', flexWrap: 'wrap', fontSize: '0.95rem' }}>
          <span>✅ придут: <strong>{rsvp.going}</strong></span>
          <span>❌ не придут: <strong>{rsvp.notGoing}</strong></span>
          <span className="muted">не ответили: {rsvp.noResponse}</span>
        </div>
      </div>

      {unreachable > 0 && (
        <div className="card stack-sm" style={{ borderColor: 'var(--danger-border)', background: 'var(--danger-soft)' }}>
          <strong>⚠️ Недостижимы: {unreachable}</strong>
          <span className="muted small">
            детей в группе без привязанного аккаунта родителя — уведомление до них не дошло. Заведите
            родителя через приглашение, иначе он узнает об изменении только при заходе.
          </span>
        </div>
      )}

      {summary.pending.length > 0 ? (
        <div className="stack-sm">
          <strong>Не подтвердили — напомните:</strong>
          {summary.pending.map((e) => (
            <div key={e.parentId} className={e.status === 'delivered' ? 'pending-row cold' : 'pending-row'}>
              <span>
                {e.parentName}
                {e.childNames.length > 0 && <span className="muted"> · {e.childNames.join(', ')}</span>}
              </span>
              <span className="muted" style={{ whiteSpace: 'nowrap' }}>
                {e.status === 'delivered' ? 'не открыл' : 'открыл, молчит'}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <p className="success-text">Все подтвердили — отлично.</p>
      )}
    </div>
  )
}
