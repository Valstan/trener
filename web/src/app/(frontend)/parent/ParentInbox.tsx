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

const card = (acked: boolean): React.CSSProperties => ({
  padding: '1rem 1.1rem',
  borderRadius: 10,
  border: `1px solid ${acked ? '#1f3a2c' : '#2c7a4b'}`,
  background: acked ? '#0e2218' : '#11261c',
  display: 'grid',
  gap: '0.5rem',
})

const ackButton = (busy: boolean): React.CSSProperties => ({
  padding: '0.55rem 1.1rem',
  fontSize: '0.95rem',
  cursor: busy ? 'default' : 'pointer',
  borderRadius: 8,
  border: 'none',
  background: busy ? '#9aa6a0' : 'var(--accent)',
  color: '#fff',
  justifySelf: 'start',
})

const rsvpButton = (active: boolean, negative = false): React.CSSProperties => ({
  padding: '0.35rem 0.7rem',
  fontSize: '0.85rem',
  cursor: 'pointer',
  borderRadius: 7,
  border: `1px solid ${active ? (negative ? '#a14a3a' : '#2c7a4b') : '#2a4636'}`,
  background: active ? (negative ? '#3a2018' : '#163a26') : 'transparent',
  color: 'var(--fg)',
  whiteSpace: 'nowrap',
})

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
    return <p style={{ color: 'var(--muted)' }}>Изменений в расписании нет — всё подтверждено. ✅</p>
  }

  return (
    <div style={{ display: 'grid', gap: '1rem' }}>
      {unacked > 0 && (
        <div style={{ color: 'var(--muted)', fontSize: '0.95rem' }}>
          Непринятых: <strong style={{ color: 'var(--fg)' }}>{unacked}</strong>
        </div>
      )}
      {items.map((i) => {
        const acked = i.status === 'acked'
        return (
          <article key={i.id} style={card(acked)}>
            <strong style={{ fontSize: '1.05rem' }}>{i.title}</strong>
            <ul style={{ margin: 0, paddingLeft: '1.1rem' }}>
              {i.lines.map((line, idx) => (
                <li key={idx}>{line}</li>
              ))}
            </ul>

            {i.type === 'cancelled'
              ? i.children.length > 0 && (
                  <div style={{ color: 'var(--muted)', fontSize: '0.9rem' }}>
                    Касается: {i.children.map((c) => c.name).join(', ')}
                  </div>
                )
              : i.children.length > 0 && (
                  <div style={{ display: 'grid', gap: '0.4rem' }}>
                    <span style={{ color: 'var(--muted)', fontSize: '0.85rem' }}>Придёте на тренировку?</span>
                    {i.children.map((c) => (
                      <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                        <span style={{ flex: '1 1 auto', minWidth: 0 }}>{c.name}</span>
                        <button type="button" style={rsvpButton(c.rsvp === 'going')} onClick={() => setRsvp(i.sessionId, c.id, 'going')}>
                          Придём
                        </button>
                        <button
                          type="button"
                          style={rsvpButton(c.rsvp === 'not_going', true)}
                          onClick={() => setRsvp(i.sessionId, c.id, 'not_going')}
                        >
                          Не придём
                        </button>
                      </div>
                    ))}
                  </div>
                )}

            {acked ? (
              <span style={{ color: 'var(--accent)', fontWeight: 600 }}>✓ Подтверждено</span>
            ) : (
              <button type="button" style={ackButton(pending === i.id)} disabled={pending === i.id} onClick={() => ack(i.id)}>
                {pending === i.id ? 'Отправляем…' : 'Вижу'}
              </button>
            )}
          </article>
        )
      })}
      {error && <p style={{ color: '#e07a6b' }}>{error}</p>}
    </div>
  )
}
