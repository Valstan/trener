'use client'

import { useRouter } from 'next/navigation'
import React, { useMemo, useState } from 'react'

type GroupOption = { id: number; name: string }
type PlayerOption = { id: number; name: string }
type ScorerRow = { playerId: number; goals: number }

// Компоновщик результата матча: группа + соперник + дата + дом/гости + счёт + авторы
// голов (динамический список из детей выбранной группы) + заметка. Status-машина формы,
// как AnnouncementComposer. На успехе — router.refresh (свежий результат появится ниже).
export const MatchComposer = ({
  groups,
  playersByGroup,
}: {
  groups: GroupOption[]
  playersByGroup: Record<number, PlayerOption[]>
}) => {
  const router = useRouter()
  const [groupId, setGroupId] = useState<number>(groups[0]?.id ?? -1)
  const [opponent, setOpponent] = useState('')
  const [matchDate, setMatchDate] = useState('')
  const [homeAway, setHomeAway] = useState<'home' | 'away'>('home')
  const [location, setLocation] = useState('')
  const [scoreOur, setScoreOur] = useState(0)
  const [scoreOpponent, setScoreOpponent] = useState(0)
  const [scorers, setScorers] = useState<ScorerRow[]>([])
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  const players = useMemo(() => playersByGroup[groupId] ?? [], [playersByGroup, groupId])

  // Смена группы обнуляет авторов голов — дети другой группы недопустимы (152-ФЗ).
  const onGroupChange = (id: number) => {
    setGroupId(id)
    setScorers([])
  }

  const addScorer = () => {
    const first = players[0]
    if (!first) return
    setScorers((prev) => [...prev, { playerId: first.id, goals: 1 }])
  }
  const updateScorer = (idx: number, patch: Partial<ScorerRow>) =>
    setScorers((prev) => prev.map((s, i) => (i === idx ? { ...s, ...patch } : s)))
  const removeScorer = (idx: number) => setScorers((prev) => prev.filter((_, i) => i !== idx))

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!opponent.trim() || !matchDate) {
      setError('Заполните соперника и дату матча.')
      return
    }
    setBusy(true)
    setError('')
    try {
      const res = await fetch('/coach/match', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          groupId,
          matchDate: new Date(matchDate).toISOString(),
          opponent: opponent.trim(),
          homeAway,
          location: location.trim() || undefined,
          scoreOur,
          scoreOpponent,
          scorers,
          note: note.trim() || undefined,
        }),
      })
      const data = (await res.json()) as { ok?: boolean }
      if (res.ok && data.ok) {
        setOpponent('')
        setMatchDate('')
        setHomeAway('home')
        setLocation('')
        setScoreOur(0)
        setScoreOpponent(0)
        setScorers([])
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
          <label htmlFor="m-group">Группа</label>
          <select
            id="m-group"
            className="select"
            value={groupId}
            onChange={(e) => onGroupChange(Number(e.target.value))}
          >
            {groups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
        </div>
      )}

      <input
        className="input"
        type="text"
        placeholder="Соперник"
        maxLength={120}
        value={opponent}
        onChange={(e) => setOpponent(e.target.value)}
      />

      <div className="field">
        <label htmlFor="m-date">Дата и время</label>
        <input
          id="m-date"
          className="input"
          type="datetime-local"
          value={matchDate}
          onChange={(e) => setMatchDate(e.target.value)}
        />
      </div>

      <div className="field">
        <label htmlFor="m-where">Где</label>
        <select
          id="m-where"
          className="select"
          value={homeAway}
          onChange={(e) => setHomeAway(e.target.value === 'away' ? 'away' : 'home')}
        >
          <option value="home">Дома</option>
          <option value="away">В гостях</option>
        </select>
      </div>

      <input
        className="input"
        type="text"
        placeholder="Место проведения (необязательно)"
        maxLength={200}
        value={location}
        onChange={(e) => setLocation(e.target.value)}
      />

      <div className="row-between" style={{ gap: '0.75rem', alignItems: 'end' }}>
        <div className="field" style={{ flex: 1 }}>
          <label htmlFor="m-our">Голов наши</label>
          <input
            id="m-our"
            className="input"
            type="number"
            min={0}
            max={999}
            value={scoreOur}
            onChange={(e) => setScoreOur(Math.max(0, Number(e.target.value) || 0))}
          />
        </div>
        <div className="field" style={{ flex: 1 }}>
          <label htmlFor="m-opp">Голов соперник</label>
          <input
            id="m-opp"
            className="input"
            type="number"
            min={0}
            max={999}
            value={scoreOpponent}
            onChange={(e) => setScoreOpponent(Math.max(0, Number(e.target.value) || 0))}
          />
        </div>
      </div>

      <div className="stack-xs">
        <span className="muted small">Авторы голов (необязательно)</span>
        {players.length === 0 ? (
          <p className="muted small" style={{ margin: 0 }}>
            В этой группе пока нет детей.
          </p>
        ) : (
          <>
            {scorers.map((s, i) => (
              <div key={i} className="row-between" style={{ gap: '0.5rem', alignItems: 'center' }}>
                <select
                  className="select"
                  style={{ flex: 1 }}
                  value={s.playerId}
                  onChange={(e) => updateScorer(i, { playerId: Number(e.target.value) })}
                  aria-label="Игрок"
                >
                  {players.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
                <input
                  className="input"
                  type="number"
                  min={1}
                  max={99}
                  style={{ width: '4.5rem' }}
                  value={s.goals}
                  onChange={(e) => updateScorer(i, { goals: Math.max(1, Number(e.target.value) || 1) })}
                  aria-label="Голов"
                />
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => removeScorer(i)}
                  aria-label="Убрать автора"
                >
                  ✕
                </button>
              </div>
            ))}
            <button type="button" className="btn btn-ghost" style={{ justifySelf: 'start' }} onClick={addScorer}>
              + Добавить автора гола
            </button>
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
        {busy ? 'Сохраняем…' : 'Сохранить результат'}
      </button>
      {done && <span className="success-text">✓ Сохранено</span>}
      {error && (
        <p className="error-text" style={{ margin: 0 }}>
          {error}
        </p>
      )}
    </form>
  )
}
