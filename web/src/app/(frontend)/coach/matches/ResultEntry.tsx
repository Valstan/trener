'use client'

import { useRouter } from 'next/navigation'
import React, { useState } from 'react'

import { ScorersEditor, type PlayerOption, type ScorerRow } from './ScorersEditor'

// Форма «внести результат» под карточкой будущего матча (п.10): счёт + авторы голов →
// POST /coach/match/result. Свёрнута в кнопку, чтобы расписание не пестрело формами.
export const ResultEntry = ({ matchId, players }: { matchId: number; players: PlayerOption[] }) => {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [scoreOur, setScoreOur] = useState(0)
  const [scoreOpponent, setScoreOpponent] = useState(0)
  const [scorers, setScorers] = useState<ScorerRow[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  if (!open) {
    return (
      <button type="button" className="btn btn-ghost" style={{ justifySelf: 'start' }} onClick={() => setOpen(true)}>
        Внести результат
      </button>
    )
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      const res = await fetch('/coach/match/result', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ matchId, scoreOur, scoreOpponent, scorers }),
      })
      const data = (await res.json()) as { ok?: boolean }
      if (res.ok && data.ok) {
        router.refresh() // матч уедет из «предстоящих» в «сыгранные»
      } else {
        setError('Не удалось сохранить. Попробуйте ещё раз.')
      }
    } catch {
      setError('Не удалось сохранить. Попробуйте ещё раз.')
    }
    setBusy(false)
  }

  return (
    <form onSubmit={submit} className="stack-sm">
      <div className="row-between" style={{ gap: '0.75rem', alignItems: 'end' }}>
        <div className="field" style={{ flex: 1 }}>
          <label htmlFor={`r-our-${matchId}`}>Голов наши</label>
          <input
            id={`r-our-${matchId}`}
            className="input"
            type="number"
            min={0}
            max={999}
            value={scoreOur}
            onChange={(e) => setScoreOur(Math.max(0, Number(e.target.value) || 0))}
          />
        </div>
        <div className="field" style={{ flex: 1 }}>
          <label htmlFor={`r-opp-${matchId}`}>Голов соперник</label>
          <input
            id={`r-opp-${matchId}`}
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

      <div className="row" style={{ gap: '0.5rem' }}>
        <button type="submit" className="btn btn-primary" disabled={busy}>
          {busy ? 'Сохраняем…' : 'Сохранить результат'}
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
