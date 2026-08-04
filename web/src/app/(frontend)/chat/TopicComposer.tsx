'use client'

import { useRouter } from 'next/navigation'
import React, { useState } from 'react'

// Заведение темы (M9) — только персонал: список групп приходит уже отфильтрованным
// под роль, сервер проверяет владение ещё раз.
export const TopicComposer = ({ groups }: { groups: { id: number; name: string }[] }) => {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [groupId, setGroupId] = useState<number>(groups[0]?.id ?? -1)
  const [title, setTitle] = useState('')
  const [room, setRoom] = useState<'adults' | 'children'>('adults')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) {
      setError('Напишите, о чём тема.')
      return
    }
    setBusy(true)
    setError('')
    try {
      const res = await fetch('/chat/topic', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ groupId, title, room }),
      })
      const data = (await res.json()) as { ok?: boolean; id?: number }
      if (res.ok && data.ok && data.id) {
        router.push(`/chat/${data.id}`)
        return
      }
      setError('Не удалось завести тему. Попробуйте ещё раз.')
    } catch {
      setError('Не удалось завести тему. Попробуйте ещё раз.')
    }
    setBusy(false)
  }

  if (!open) {
    return (
      <button type="button" className="btn btn-ghost" style={{ marginBottom: '1rem' }} onClick={() => setOpen(true)}>
        + Завести тему
      </button>
    )
  }

  return (
    <form onSubmit={submit} className="stack-sm card" style={{ marginBottom: '1rem' }}>
      {groups.length > 1 && (
        <div className="field">
          <label htmlFor="t-group">Группа</label>
          <select id="t-group" className="select" value={groupId} onChange={(e) => setGroupId(Number(e.target.value))}>
            {groups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
        </div>
      )}
      <div className="field">
        <label htmlFor="t-room">Комната</label>
        <select id="t-room" className="select" value={room} onChange={(e) => setRoom(e.target.value === 'children' ? 'children' : 'adults')}>
          <option value="adults">Взрослая</option>
          <option value="children">Детская</option>
        </select>
      </div>
      <div className="field">
        <label htmlFor="t-title">О чём тема</label>
        <input
          id="t-title"
          className="input"
          type="text"
          maxLength={120}
          placeholder="например, Едем на соревнования 12 сентября"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
      </div>
      <div className="row" style={{ gap: '0.5rem' }}>
        <button type="submit" className="btn btn-primary" disabled={busy}>
          {busy ? 'Заводим…' : 'Завести'}
        </button>
        <button type="button" className="btn btn-ghost" onClick={() => setOpen(false)} disabled={busy}>
          Отмена
        </button>
      </div>
      {error && (
        <p className="error-text" style={{ margin: 0 }}>
          {error}
        </p>
      )}
    </form>
  )
}
