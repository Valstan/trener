'use client'

import React, { useEffect, useState } from 'react'

type RsvpResponse = 'going' | 'not_going'

type InboxChild = { id: number; name: string; rsvp: RsvpResponse | null }

export type InboxItem = {
  id: number
  sessionId: number
  type: 'changed' | 'cancelled'
  status: 'delivered' | 'seen' | 'acked' | 'superseded'
  title: string
  lines: string[]
  children: InboxChild[]
}

// In-app очередь непринятых: подсветка непринятых + кнопка «Вижу» (ack). На открытии
// помечаем delivered→seen (POST /parent/seen, на маунте — не на prefetch). ack
// оптимистично флипает карточку, не перезагружая страницу.
export const ParentInbox = ({ items: initial }: { items: InboxItem[] }) => {
  const [items, setItems] = useState<InboxItem[]>(initial)
  const [pending, setPending] = useState<number | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    if (initial.some((i) => i.status === 'delivered')) {
      fetch('/parent/seen', { method: 'POST' }).catch(() => {})
    }
  }, [initial])

  const unacked = items.filter((i) => i.status !== 'acked').length

  const ack = async (id: number) => {
    setPending(id)
    setError('')
    try {
      const res = await fetch('/parent/ack', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notificationId: id }),
      })
      const data = (await res.json()) as { ok?: boolean; reason?: string }
      if (res.ok && data.ok) {
        setItems((prev) => prev.map((i) => (i.id === id ? { ...i, status: 'acked' } : i)))
      } else if (data.reason === 'stale') {
        setError('Это изменение устарело — обновите страницу.')
      } else {
        setError('Не удалось подтвердить. Попробуйте ещё раз.')
      }
    } catch {
      setError('Не удалось подтвердить. Попробуйте ещё раз.')
    }
    setPending(null)
  }

  // RSVP «придём / не придём» по (session × ребёнок). Оптимистично, 1 тап.
  const setRsvp = async (sessionId: number, childId: number, response: RsvpResponse) => {
    setItems((prev) =>
      prev.map((i) =>
        i.sessionId === sessionId
          ? { ...i, children: i.children.map((c) => (c.id === childId ? { ...c, rsvp: response } : c)) }
          : i,
      ),
    )
    try {
      await fetch('/parent/rsvp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, playerId: childId, response }),
      })
    } catch {
      // оптимистично оставляем выбор; повторный тап/перезагрузка сверят с сервером
    }
  }

  if (items.length === 0) {
    return (
      <div className="empty-state">
        <span className="ic" aria-hidden>
          ✅
        </span>
        Изменений в расписании нет — всё подтверждено.
      </div>
    )
  }

  return (
    <div className="stack">
      {unacked > 0 && (
        <div className="muted small">
          Непринятых: <strong style={{ color: 'var(--fg)' }}>{unacked}</strong>
        </div>
      )}
      {items.map((i) => {
        const acked = i.status === 'acked'
        return (
          <article key={i.id} className={acked ? 'card stack-sm' : 'card card-accent stack-sm'}>
            <strong style={{ fontSize: '1.05rem' }}>{i.title}</strong>
            <ul className="list-reset">
              {i.lines.map((line, idx) => (
                <li key={idx}>{line}</li>
              ))}
            </ul>

            {i.type === 'cancelled'
              ? i.children.length > 0 && (
                  <div className="muted small">Касается: {i.children.map((c) => c.name).join(', ')}</div>
                )
              : i.children.length > 0 && (
                  <div className="stack-sm">
                    <span className="muted small">Придёте на тренировку?</span>
                    {i.children.map((c) => (
                      <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                        <span style={{ flex: '1 1 auto', minWidth: 0 }}>{c.name}</span>
                        <div className="seg">
                          <button
                            type="button"
                            className={c.rsvp === 'going' ? 'seg-btn on' : 'seg-btn'}
                            onClick={() => setRsvp(i.sessionId, c.id, 'going')}
                          >
                            Придём
                          </button>
                          <button
                            type="button"
                            className={c.rsvp === 'not_going' ? 'seg-btn on-neg' : 'seg-btn'}
                            onClick={() => setRsvp(i.sessionId, c.id, 'not_going')}
                          >
                            Не придём
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

            {acked ? (
              <span className="success-text">✓ Подтверждено</span>
            ) : (
              <button
                type="button"
                className="btn btn-primary"
                style={{ justifySelf: 'start' }}
                disabled={pending === i.id}
                onClick={() => ack(i.id)}
              >
                {pending === i.id ? 'Отправляем…' : 'Вижу'}
              </button>
            )}
          </article>
        )
      })}
      {error && <p className="error-text">{error}</p>}
    </div>
  )
}
