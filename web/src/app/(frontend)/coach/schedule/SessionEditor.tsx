'use client'

import { useRouter } from 'next/navigation'
import React, { useState } from 'react'

export type SessionForEdit = {
  id: number
  startDate: string
  endDate?: string | null
  location?: string | null
  note?: string | null
  status: string
}

// ISO из БД → значение для <input type="datetime-local"> в локальном поясе.
const toLocalInput = (iso?: string | null): string => {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

// Inline-правка тренировки в карточке расписания: перенос (дата/место), заметка,
// отмена (двухшаговая кнопка). Правка даты/места поднимает волну ядра M2 —
// родители получат пуш, статус флипнется в «Изменена» сам (trackSessionChange).
export const SessionEditor = ({ session }: { session: SessionForEdit }) => {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [startDate, setStartDate] = useState(toLocalInput(session.startDate))
  const [endDate, setEndDate] = useState(toLocalInput(session.endDate))
  const [location, setLocation] = useState(session.location ?? '')
  const [note, setNote] = useState(session.note ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [confirmCancel, setConfirmCancel] = useState(false)

  const send = async (body: Record<string, unknown>): Promise<boolean> => {
    setBusy(true)
    setError('')
    try {
      const res = await fetch('/coach/session', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: session.id, ...body }),
      })
      const data = (await res.json()) as { ok?: boolean }
      if (res.ok && data.ok) {
        router.refresh()
        setBusy(false)
        return true
      }
    } catch {
      // ниже общий error
    }
    setError('Не удалось сохранить. Попробуйте ещё раз.')
    setBusy(false)
    return false
  }

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!startDate) {
      setError('Укажите дату и время начала.')
      return
    }
    if (endDate && new Date(endDate) <= new Date(startDate)) {
      setError('Окончание должно быть позже начала.')
      return
    }
    const ok = await send({
      startDate: new Date(startDate).toISOString(),
      endDate: endDate ? new Date(endDate).toISOString() : '',
      location: location.trim(),
      note: note.trim(),
    })
    if (ok) setOpen(false)
  }

  const cancelSession = async () => {
    if (!confirmCancel) {
      setConfirmCancel(true)
      return
    }
    const ok = await send({ cancel: true })
    if (ok) {
      setConfirmCancel(false)
      setOpen(false)
    }
  }

  if (!open) {
    return (
      <button type="button" className="btn btn-ghost" style={{ justifySelf: 'start' }} onClick={() => setOpen(true)}>
        ✎ Изменить
      </button>
    )
  }

  return (
    <form onSubmit={save} className="stack-sm" style={{ borderTop: '1px solid var(--border)', paddingTop: '0.75rem' }}>
      <div className="row-between" style={{ gap: '0.75rem', alignItems: 'end', flexWrap: 'wrap' }}>
        <div className="field" style={{ flex: 1, minWidth: '12rem' }}>
          <label htmlFor={`e-start-${session.id}`}>Начало</label>
          <input
            id={`e-start-${session.id}`}
            className="input"
            type="datetime-local"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
        </div>
        <div className="field" style={{ flex: 1, minWidth: '12rem' }}>
          <label htmlFor={`e-end-${session.id}`}>Окончание</label>
          <input
            id={`e-end-${session.id}`}
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
        placeholder="Место проведения"
        maxLength={200}
        value={location}
        onChange={(e) => setLocation(e.target.value)}
      />

      <textarea
        className="textarea"
        placeholder="Заметка тренера"
        maxLength={500}
        value={note}
        onChange={(e) => setNote(e.target.value)}
      />

      <div className="row-between" style={{ gap: '0.5rem', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button type="submit" className="btn btn-primary" disabled={busy}>
            {busy ? 'Сохраняем…' : 'Сохранить'}
          </button>
          <button
            type="button"
            className="btn btn-ghost"
            disabled={busy}
            onClick={() => {
              setOpen(false)
              setConfirmCancel(false)
              setError('')
            }}
          >
            Закрыть
          </button>
        </div>
        {session.status !== 'cancelled' && (
          <button type="button" className="btn btn-ghost" disabled={busy} onClick={cancelSession}>
            {confirmCancel ? 'Точно отменить тренировку?' : 'Отменить тренировку'}
          </button>
        )}
      </div>
      {error && (
        <p className="error-text" style={{ margin: 0 }}>
          {error}
        </p>
      )}
    </form>
  )
}
