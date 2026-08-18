'use client'

import { useRouter } from 'next/navigation'
import React, { useMemo, useState } from 'react'

import { ScorersEditor, type PlayerOption, type ScorerRow } from './ScorersEditor'

type GroupOption = { id: number; name: string }

// Компоновщик матча: два режима — «результат» (счёт + авторы голов) и «будущий матч»
// (только когда/где — расписание, видение §3.1; счёт вносится позже через ResultEntry).
// Группа + соперник + дата + дом/гости общие. Status-машина формы, как
// AnnouncementComposer. На успехе — router.refresh (запись появится в ленте ниже).
export const MatchComposer = ({
  groups,
  playersByGroup,
}: {
  groups: GroupOption[]
  playersByGroup: Record<number, PlayerOption[]>
}) => {
  const router = useRouter()
  const [mode, setMode] = useState<'result' | 'upcoming'>('result')
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

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!opponent.trim() || !matchDate) {
      setError('Заполните соперника и дату матча.')
      return
    }
    setBusy(true)
    setError('')
    try {
      // Будущий матч — без счёта и авторов голов (сервер требует «парой или никак»).
      const withScore = mode === 'result'
      const res = await fetch('/coach/match', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          groupId,
          matchDate: new Date(matchDate).toISOString(),
          opponent: opponent.trim(),
          homeAway,
          location: location.trim() || undefined,
          scoreOur: withScore ? scoreOur : undefined,
          scoreOpponent: withScore ? scoreOpponent : undefined,
          scorers: withScore ? scorers : [],
          note: note.trim() || undefined,
        }),
      })
      const data = (await res.json()) as { ok?: boolean; error?: string }
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
        // Сервер мог прислать осмысленный текст (например, лимит демо D-029).
        setError(data.error || 'Не удалось сохранить. Попробуйте ещё раз.')
      }
    } catch {
      setError('Не удалось сохранить. Попробуйте ещё раз.')
    }
    setBusy(false)
  }

  return (
    <form onSubmit={submit} className="stack-sm card">
      <div className="field">
        <label htmlFor="m-mode">Что заводим</label>
        <select
          id="m-mode"
          className="select"
          value={mode}
          onChange={(e) => setMode(e.target.value === 'upcoming' ? 'upcoming' : 'result')}
        >
          <option value="result">Результат сыгранного матча</option>
          <option value="upcoming">Будущий матч (расписание)</option>
        </select>
      </div>

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

      {mode === 'result' && (
        <>
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

          <ScorersEditor players={players} scorers={scorers} onChange={setScorers} />
        </>
      )}

      <textarea
        className="textarea"
        placeholder="Заметка тренера (необязательно)"
        maxLength={500}
        value={note}
        onChange={(e) => setNote(e.target.value)}
      />

      <button type="submit" className="btn btn-primary" style={{ justifySelf: 'start' }} disabled={busy}>
        {busy ? 'Сохраняем…' : mode === 'result' ? 'Сохранить результат' : 'Добавить в расписание'}
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
