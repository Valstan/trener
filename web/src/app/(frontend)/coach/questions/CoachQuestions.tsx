'use client'

import React, { useEffect, useState } from 'react'

export type QuestionItem = {
  id: number
  status: 'new' | 'read' | 'answered'
  groupName: string | null
  parentName: string
  parentPhone: string | null
  body: string
  createdAt: string | null
}

const card = (status: QuestionItem['status']): React.CSSProperties => ({
  padding: '0.9rem 1.05rem',
  borderRadius: 10,
  border: `1px solid ${status === 'new' ? '#2c7a4b' : '#1f3a2c'}`,
  background: status === 'answered' ? '#0e2218' : '#11261c',
  display: 'grid',
  gap: '0.35rem',
})

const btn = (busy: boolean): React.CSSProperties => ({
  padding: '0.45rem 0.9rem',
  fontSize: '0.9rem',
  cursor: busy ? 'default' : 'pointer',
  borderRadius: 8,
  border: 'none',
  background: busy ? '#9aa6a0' : 'var(--accent)',
  color: '#fff',
  justifySelf: 'start',
})

const fmt = (iso: string | null): string => {
  if (!iso) return ''
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleString('ru-RU', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })
}

const order: Record<QuestionItem['status'], number> = { new: 0, read: 1, answered: 2 }

// Инбокс вопросов тренера. На маунте помечает new→read (тренер увидел очередь). Кнопка
// «Ответил» двигает в answered (тренер отвечает оффлайн/звонком — контакт родителя рядом).
export const CoachQuestions = ({ items: initial }: { items: QuestionItem[] }) => {
  const [items, setItems] = useState<QuestionItem[]>(initial)
  const [busy, setBusy] = useState<number | null>(null)

  useEffect(() => {
    const fresh = initial.filter((q) => q.status === 'new')
    if (fresh.length) {
      Promise.all(
        fresh.map((q) =>
          fetch(`/coach/question/${q.id}/status`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'read' }),
          }).catch(() => {}),
        ),
      ).then(() => setItems((prev) => prev.map((q) => (q.status === 'new' ? { ...q, status: 'read' } : q))))
    }
  }, [initial])

  const markAnswered = async (id: number) => {
    setBusy(id)
    try {
      const res = await fetch(`/coach/question/${id}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'answered' }),
      })
      const data = (await res.json()) as { ok?: boolean }
      if (res.ok && data.ok) setItems((prev) => prev.map((q) => (q.id === id ? { ...q, status: 'answered' } : q)))
    } catch {
      // оставляем как есть; повторный тап/перезагрузка сверят
    }
    setBusy(null)
  }

  if (items.length === 0) return <p style={{ color: 'var(--muted)' }}>Вопросов пока нет.</p>

  const sorted = [...items].sort((a, b) => order[a.status] - order[b.status] || (b.createdAt ?? '').localeCompare(a.createdAt ?? ''))

  return (
    <div style={{ display: 'grid', gap: '0.6rem' }}>
      {sorted.map((q) => (
        <article key={q.id} style={card(q.status)}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', alignItems: 'baseline' }}>
            <strong>
              {q.status === 'new' && <span style={{ color: 'var(--accent)', marginRight: '0.4rem' }}>•</span>}
              {q.parentName}
            </strong>
            <span style={{ color: 'var(--muted)', fontSize: '0.8rem', whiteSpace: 'nowrap' }}>{fmt(q.createdAt)}</span>
          </div>
          <div style={{ color: 'var(--muted)', fontSize: '0.85rem' }}>
            {q.groupName ?? 'Группа'}
            {q.parentPhone ? ` · ${q.parentPhone}` : ''}
          </div>
          <p style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{q.body}</p>
          {q.status === 'answered' ? (
            <span style={{ color: 'var(--accent)', fontWeight: 600 }}>✓ Отвечено</span>
          ) : (
            <button type="button" style={btn(busy === q.id)} disabled={busy === q.id} onClick={() => markAnswered(q.id)}>
              {busy === q.id ? 'Отмечаем…' : 'Ответил'}
            </button>
          )}
        </article>
      ))}
    </div>
  )
}
