'use client'

import React, { useState } from 'react'

// Кнопки «Придём / Не придём» по каждому ребёнку на карточке тренировки.
// Тот же POST /parent/rsvp, что в карточке уведомления (ParentInbox) — upsert по
// (session × player), повторный тап меняет ответ. Оптимистичное локальное состояние;
// при ошибке откатываем и просим повторить.
type ChildRow = { id: number; name: string; rsvp: 'going' | 'not_going' | null }

export const RsvpButtons = ({ sessionId, childRows }: { sessionId: number; childRows: ChildRow[] }) => {
  const [rows, setRows] = useState(childRows)
  const [error, setError] = useState(false)

  const setRsvp = async (playerId: number, response: 'going' | 'not_going') => {
    const prev = rows
    setRows((rs) => rs.map((r) => (r.id === playerId ? { ...r, rsvp: response } : r)))
    setError(false)
    try {
      const res = await fetch('/parent/rsvp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, playerId, response }),
      })
      if (!res.ok) throw new Error()
    } catch {
      setRows(prev)
      setError(true)
    }
  }

  if (!rows.length) return null

  return (
    <div className="stack-sm">
      <span className="muted small">Придёте на тренировку?</span>
      {rows.map((c) => (
        <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          <span style={{ flex: '1 1 auto', minWidth: 0 }}>{c.name}</span>
          <div className="seg">
            <button
              type="button"
              className={c.rsvp === 'going' ? 'seg-btn on' : 'seg-btn'}
              onClick={() => setRsvp(c.id, 'going')}
            >
              Придём
            </button>
            <button
              type="button"
              className={c.rsvp === 'not_going' ? 'seg-btn on-neg' : 'seg-btn'}
              onClick={() => setRsvp(c.id, 'not_going')}
            >
              Не придём
            </button>
          </div>
        </div>
      ))}
      {error && <span className="muted small">Не удалось сохранить — попробуйте ещё раз.</span>}
    </div>
  )
}
