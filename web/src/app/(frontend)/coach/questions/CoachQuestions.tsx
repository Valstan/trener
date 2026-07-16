'use client'

import Link from 'next/link'
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

const cardClass = (status: QuestionItem['status']): string =>
  status === 'new' ? 'card card-accent stack-sm' : status === 'answered' ? 'card card-muted stack-sm' : 'card stack-sm'

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

  if (items.length === 0)
    return (
      <div className="empty-state">
        <span className="ic" aria-hidden>
          💬
        </span>
        Вопросов пока нет.
      </div>
    )

  const sorted = [...items].sort((a, b) => order[a.status] - order[b.status] || (b.createdAt ?? '').localeCompare(a.createdAt ?? ''))

  return (
    <div className="stack-sm">
      {sorted.map((q) => (
        <article key={q.id} className={cardClass(q.status)}>
          <div className="row-between" style={{ alignItems: 'baseline' }}>
            <strong>
              {q.status === 'new' && <span className="dot" aria-hidden />}
              {q.parentName}
            </strong>
            <span className="muted small" style={{ whiteSpace: 'nowrap' }}>{fmt(q.createdAt)}</span>
          </div>
          <div className="muted small">
            {q.groupName ?? 'Группа'}
            {q.parentPhone ? ` · ${q.parentPhone}` : ''}
          </div>
          <p className="pre">{q.body}</p>
          <div className="row-between" style={{ alignItems: 'center' }}>
            {q.status === 'answered' ? (
              <span className="success-text">✓ Отвечено</span>
            ) : (
              <button
                type="button"
                className="btn btn-primary btn-sm"
                style={{ justifySelf: 'start' }}
                disabled={busy === q.id}
                onClick={() => markAnswered(q.id)}
              >
                {busy === q.id ? 'Отмечаем…' : 'Ответил'}
              </button>
            )}
            <Link href={`/coach/question/${q.id}`}>Переписка →</Link>
          </div>
        </article>
      ))}
    </div>
  )
}
