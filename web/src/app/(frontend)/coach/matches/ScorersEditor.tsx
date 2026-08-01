'use client'

import React from 'react'

export type PlayerOption = { id: number; name: string }
export type ScorerRow = { playerId: number; goals: number }

// Редактор списка авторов голов — строки «игрок × голы». Общий для компоновщика
// матча и формы «внести результат». Пикер только из детей переданной группы (152-ФЗ).
export const ScorersEditor = ({
  players,
  scorers,
  onChange,
}: {
  players: PlayerOption[]
  scorers: ScorerRow[]
  onChange: (next: ScorerRow[]) => void
}) => {
  const addScorer = () => {
    const first = players[0]
    if (!first) return
    onChange([...scorers, { playerId: first.id, goals: 1 }])
  }
  const updateScorer = (idx: number, patch: Partial<ScorerRow>) =>
    onChange(scorers.map((s, i) => (i === idx ? { ...s, ...patch } : s)))
  const removeScorer = (idx: number) => onChange(scorers.filter((_, i) => i !== idx))

  return (
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
  )
}
