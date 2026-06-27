'use client'

import React, { useState } from 'react'

type GroupOption = { id: number; name: string }

// «Вопрос тренеру» (M3-PR11, суррогат чата). Родитель выбирает группу (своих детей) и
// пишет одно сообщение → тренер видит в инбоксе. Двусторонняя переписка — M4.
export const QuestionForm = ({ groups }: { groups: GroupOption[] }) => {
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
    <form onSubmit={submit} className="stack-sm card">
      {done && <p className="success-text" style={{ margin: 0 }}>✓ Отправлено тренеру</p>}
      {groups.length > 1 && (
        <div className="field">
          <label htmlFor="q-group">Группа</label>
          <select id="q-group" className="select" value={groupId} onChange={(e) => setGroupId(Number(e.target.value))}>
            {groups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
        </div>
      )}
      <textarea
        className="textarea"
        placeholder="Ваш вопрос тренеру"
        maxLength={1000}
        value={body}
        onChange={(e) => setBody(e.target.value)}
      />
      <button type="submit" className="btn btn-primary" style={{ justifySelf: 'start' }} disabled={busy}>
        {busy ? 'Отправляем…' : 'Отправить'}
      </button>
      {error && <p className="error-text" style={{ margin: 0 }}>{error}</p>}
    </form>
  )
}
