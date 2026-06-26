'use client'

import React, { useState } from 'react'

type GroupOption = { id: number; name: string }

const field: React.CSSProperties = {
  width: '100%',
  padding: '0.6rem 0.7rem',
  borderRadius: 8,
  border: '1px solid #2a4636',
  background: '#0e2218',
  color: 'var(--fg)',
  fontSize: '0.95rem',
  fontFamily: 'inherit',
}

const submitBtn = (busy: boolean): React.CSSProperties => ({
  padding: '0.55rem 1.1rem',
  fontSize: '0.95rem',
  cursor: busy ? 'default' : 'pointer',
  borderRadius: 8,
  border: 'none',
  background: busy ? '#9aa6a0' : 'var(--accent)',
  color: '#fff',
  justifySelf: 'start',
})

// «Вопрос тренеру» (M3-PR11, суррогат чата). Родитель выбирает группу (своих детей) и
// пишет одно сообщение → тренер видит в инбоксе. Свёрнут по умолчанию, чтобы не шуметь
// на экране изменений. Двусторонняя переписка — M4.
export const QuestionForm = ({ groups }: { groups: GroupOption[] }) => {
  const [open, setOpen] = useState(false)
  const [groupId, setGroupId] = useState<number>(groups[0]?.id ?? -1)
  const [body, setBody] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  if (groups.length === 0) return null

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!body.trim()) {
      setError('Напишите вопрос.')
      return
    }
    setBusy(true)
    setError('')
    try {
      const res = await fetch('/parent/question', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ groupId, body: body.trim() }),
      })
      const data = (await res.json()) as { ok?: boolean }
      if (res.ok && data.ok) {
        setBody('')
        setDone(true)
        setOpen(false)
        setTimeout(() => setDone(false), 3000)
      } else {
        setError('Не удалось отправить. Попробуйте ещё раз.')
      }
    } catch {
      setError('Не удалось отправить. Попробуйте ещё раз.')
    }
    setBusy(false)
  }

  return (
    <section style={{ marginTop: '2rem' }}>
      <h2 style={{ fontSize: '1.05rem', margin: '0 0 0.5rem' }}>Вопрос тренеру</h2>
      {done && <p style={{ color: 'var(--accent)', fontWeight: 600, margin: '0 0 0.5rem' }}>✓ Отправлено тренеру</p>}
      {!open ? (
        <button type="button" style={submitBtn(false)} onClick={() => setOpen(true)}>
          Задать вопрос
        </button>
      ) : (
        <form onSubmit={submit} style={{ display: 'grid', gap: '0.6rem' }}>
          {groups.length > 1 && (
            <label style={{ display: 'grid', gap: '0.25rem' }}>
              <span style={{ color: 'var(--muted)', fontSize: '0.85rem' }}>Группа</span>
              <select style={field} value={groupId} onChange={(e) => setGroupId(Number(e.target.value))}>
                {groups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          <textarea
            style={{ ...field, minHeight: 80, resize: 'vertical' }}
            placeholder="Ваш вопрос тренеру"
            maxLength={1000}
            value={body}
            onChange={(e) => setBody(e.target.value)}
          />
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button type="submit" style={submitBtn(busy)} disabled={busy}>
              {busy ? 'Отправляем…' : 'Отправить'}
            </button>
            <button
              type="button"
              style={{ ...submitBtn(false), background: 'transparent', border: '1px solid #2a4636', color: 'var(--fg)' }}
              onClick={() => setOpen(false)}
            >
              Отмена
            </button>
          </div>
          {error && <p style={{ color: '#e07a6b', margin: 0 }}>{error}</p>}
        </form>
      )}
    </section>
  )
}
