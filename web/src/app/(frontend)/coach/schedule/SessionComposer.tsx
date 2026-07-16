'use client'

import { useRouter } from 'next/navigation'
import React, { useState } from 'react'

type GroupOption = { id: number; name: string }

// Компоновщик тренировки: группа + начало + окончание? + место? + заметка?.
// Status-машина формы как MatchComposer. Создание — planned, волны нет.
export const SessionComposer = ({ groups }: { groups: GroupOption[] }) => {
  const router = useRouter()
  const [groupId, setGroupId] = useState<number>(groups[0]?.id ?? -1)
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [location, setLocation] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!startDate) {
      setError('Укажите дату и время начала.')
      return
    }
    if (endDate && new Date(endDate) <= new Date(startDate)) {
      setError('Окончание должно быть позже начала.')
      return
    }
    setBusy(true)
    setError('')
    try {
      const res = await fetch('/coach/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          groupId,
          startDate: new Date(startDate).toISOString(),
          endDate: endDate ? new Date(endDate).toISOString() : undefined,
          location: location.trim() || undefined,
          note: note.trim() || undefined,
        }),
      })
      const data = (await res.json()) as { ok?: boolean }
      if (res.ok && data.ok) {
        setStartDate('')
        setEndDate('')
        setLocation('')
        setNote('')
        setDone(true)
        router.refresh()
        setTimeout(() => setDone(false), 2500)
      } else {
        setError('Не удалось сохранить. Попробуйте ещё раз.')
      }
    } catch {
      setError('Не удалось сохранить. Попробуйте ещё раз.')
    }
    setBusy(false)
  }

  return (
    <form onSubmit={submit} className="stack-sm card">
      {groups.length > 1 && (
        <div className="field">
          <label htmlFor="s-group">Группа</label>
          <select
            id="s-group"
            className="select"
            value={groupId}
            onChange={(e) => setGroupId(Number(e.target.value))}
          >
            {groups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="row-between" style={{ gap: '0.75rem', alignItems: 'end', flexWrap: 'wrap' }}>
        <div className="field" style={{ flex: 1, minWidth: '12rem' }}>
          <label htmlFor="s-start">Начало</label>
          <input
            id="s-start"
            className="input"
            type="datetime-local"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
        </div>
        <div className="field" style={{ flex: 1, minWidth: '12rem' }}>
          <label htmlFor="s-end">Окончание (необязательно)</label>
          <input
            id="s-end"
            className="input"
            type="datetime-local"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
          />
        </div>
      </div>

      <input
        className="input"
        type="text"
        placeholder="Место проведения (необязательно)"
        maxLength={200}
        value={location}
        onChange={(e) => setLocation(e.target.value)}
      />

      <textarea
        className="textarea"
        placeholder="Заметка тренера (необязательно)"
        maxLength={500}
        value={note}
        onChange={(e) => setNote(e.target.value)}
      />

      <button type="submit" className="btn btn-primary" style={{ justifySelf: 'start' }} disabled={busy}>
        {busy ? 'Сохраняем…' : 'Добавить тренировку'}
      </button>
      {done && <span className="success-text">✓ Добавлена</span>}
      {error && (
        <p className="error-text" style={{ margin: 0 }}>
          {error}
        </p>
      )}
    </form>
  )
}
