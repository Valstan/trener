'use client'

import { useRouter } from 'next/navigation'
import React, { useMemo, useState } from 'react'

import { MAX_OCCURRENCES, WEEKDAY_LABELS, expandWeekly } from '@/lib/repeatSchedule'

type GroupOption = { id: number; name: string }

const plural = (n: number, one: string, few: string, many: string): string => {
  const m10 = n % 10
  const m100 = n % 100
  if (m10 === 1 && m100 !== 11) return one
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few
  return many
}

// Компоновщик тренировки: группа + начало + окончание? + место? + заметка?.
// Status-машина формы как MatchComposer. Создание — planned, волны нет.
//
// Повторы (п.2 аудита 30.07): галочка «повторять» + дни недели + «по дату». Разворот
// в список занятий считается ЗДЕСЬ, в часовом поясе тренера (lib/repeatSchedule), и
// уходит пачкой одним запросом — сервер валидирует каждое занятие заново.
export const SessionComposer = ({ groups }: { groups: GroupOption[] }) => {
  const router = useRouter()
  const [groupId, setGroupId] = useState<number>(groups[0]?.id ?? -1)
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [location, setLocation] = useState('')
  const [note, setNote] = useState('')
  const [repeat, setRepeat] = useState(false)
  const [weekdays, setWeekdays] = useState<number[]>([])
  const [until, setUntil] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState('')

  const toggleWeekday = (value: number): void =>
    setWeekdays((prev) => (prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]))

  // Предпросмотр: сколько занятий заведём. Пересчитывается на каждый ввод — тренер
  // видит цену своей галочки до нажатия, а не после.
  const occurrences = useMemo(() => {
    if (!startDate) return []
    const start = new Date(startDate)
    const end = endDate ? new Date(endDate) : null
    if (!repeat || weekdays.length === 0 || !until) {
      return expandWeekly({ start, end, weekdays: [], until: start })
    }
    return expandWeekly({ start, end, weekdays, until: new Date(until) })
  }, [startDate, endDate, repeat, weekdays, until])

  const repeating = repeat && weekdays.length > 0 && Boolean(until)

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
    if (repeat && weekdays.length === 0) {
      setError('Отметьте хотя бы один день недели или снимите «повторять».')
      return
    }
    if (repeat && !until) {
      setError('Укажите, по какое число повторять.')
      return
    }
    if (repeating && occurrences.length === 0) {
      setError('В этом диапазоне нет ни одного занятия — проверьте дату «по».')
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
          occurrences,
          location: location.trim() || undefined,
          note: note.trim() || undefined,
        }),
      })
      const data = (await res.json()) as { ok?: boolean; created?: number }
      if (res.ok && data.ok) {
        const n = data.created ?? 1
        setStartDate('')
        setEndDate('')
        setLocation('')
        setNote('')
        setRepeat(false)
        setWeekdays([])
        setUntil('')
        setDone(n === 1 ? '✓ Добавлена' : `✓ Добавлено ${n} ${plural(n, 'занятие', 'занятия', 'занятий')}`)
        router.refresh()
        setTimeout(() => setDone(''), 3500)
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

      <div className="field">
        <label htmlFor="s-location">Место проведения (необязательно)</label>
        <input
          id="s-location"
          className="input"
          type="text"
          placeholder="например, Стадион «Юность», поле 1"
          maxLength={200}
          value={location}
          onChange={(e) => setLocation(e.target.value)}
        />
      </div>

      <div className="stack-sm">
        <label className="row" style={{ gap: '0.5rem', alignItems: 'center' }}>
          <input type="checkbox" checked={repeat} onChange={(e) => setRepeat(e.target.checked)} />
          <span>Повторять каждую неделю</span>
        </label>

        {repeat && (
          <>
            <div className="row" style={{ gap: '0.35rem', flexWrap: 'wrap' }}>
              {WEEKDAY_LABELS.map((w) => (
                <button
                  key={w.value}
                  type="button"
                  className={weekdays.includes(w.value) ? 'btn btn-primary btn-sm' : 'btn btn-ghost btn-sm'}
                  aria-pressed={weekdays.includes(w.value)}
                  onClick={() => toggleWeekday(w.value)}
                >
                  {w.short}
                </button>
              ))}
            </div>
            <div className="field">
              <label htmlFor="s-until">Повторять по</label>
              <input
                id="s-until"
                className="input"
                type="date"
                value={until}
                onChange={(e) => setUntil(e.target.value)}
              />
            </div>
            {repeating && (
              <p className="muted small" style={{ margin: 0 }}>
                {occurrences.length === MAX_OCCURRENCES
                  ? `Заведём ${MAX_OCCURRENCES} занятий — это предел за один раз. Остальное добавьте следующей пачкой.`
                  : `Заведём ${occurrences.length} ${plural(occurrences.length, 'занятие', 'занятия', 'занятий')}.`}
              </p>
            )}
          </>
        )}
      </div>

      <textarea
        className="textarea"
        placeholder="Заметка тренера (необязательно)"
        maxLength={500}
        value={note}
        onChange={(e) => setNote(e.target.value)}
      />

      <button type="submit" className="btn btn-primary" style={{ justifySelf: 'start' }} disabled={busy}>
        {busy
          ? 'Сохраняем…'
          : repeating && occurrences.length > 1
            ? `Добавить ${occurrences.length} ${plural(occurrences.length, 'тренировку', 'тренировки', 'тренировок')}`
            : 'Добавить тренировку'}
      </button>
      {done && <span className="success-text">{done}</span>}
      {error && (
        <p className="error-text" style={{ margin: 0 }}>
          {error}
        </p>
      )}
    </form>
  )
}
