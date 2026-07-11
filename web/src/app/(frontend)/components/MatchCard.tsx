import React from 'react'

import { formatDateTime } from '@/lib/notifications/describe'

// Карточка результата матча — общий презентационный компонент для лент тренера и
// родителя. Server-only (данные уже нормализованы вызывающей страницей: имена групп
// и авторов голов разрезолвлены через overrideAccess, 152-ФЗ: только имя ребёнка).
export type MatchView = {
  id: number
  matchDate: string | null
  opponent: string
  homeAway: 'home' | 'away'
  location?: string | null
  scoreOur: number
  scoreOpponent: number
  groupName?: string | null
  scorers: { name: string; goals: number }[]
  note?: string | null
}

// Исход по счёту — для акцента цветом/эмодзи (наши слева).
const outcome = (our: number, opp: number): { label: string; cls: string } => {
  if (our > opp) return { label: 'Победа', cls: 'win' }
  if (our < opp) return { label: 'Поражение', cls: 'loss' }
  return { label: 'Ничья', cls: 'draw' }
}

export const MatchCard = ({ match }: { match: MatchView }) => {
  const res = outcome(match.scoreOur, match.scoreOpponent)
  return (
    <article className="card stack-sm">
      <div className="row-between" style={{ alignItems: 'baseline' }}>
        <span className="muted small">
          {match.homeAway === 'home' ? 'Дома' : 'В гостях'}
          {match.groupName ? ` · ${match.groupName}` : ''}
        </span>
        <span className="muted small" style={{ whiteSpace: 'nowrap' }}>
          {match.matchDate ? formatDateTime(match.matchDate) : ''}
        </span>
      </div>

      <div className="row-between" style={{ alignItems: 'center', gap: '0.75rem' }}>
        <strong style={{ flex: 1 }}>Наши</strong>
        <span className={`match-score match-${res.cls}`}>
          {match.scoreOur} : {match.scoreOpponent}
        </span>
        <strong style={{ flex: 1, textAlign: 'right' }}>{match.opponent}</strong>
      </div>
      <div className="muted small" style={{ textAlign: 'center' }}>{res.label}</div>

      {match.location ? <div className="muted small">📍 {match.location}</div> : null}

      {match.scorers.length > 0 && (
        <div className="stack-xs">
          <span className="muted small">Голы:</span>
          <ul className="scorer-list">
            {match.scorers.map((s, i) => (
              <li key={i}>
                ⚽ {s.name}
                {s.goals > 1 ? ` ×${s.goals}` : ''}
              </li>
            ))}
          </ul>
        </div>
      )}

      {match.note ? <p className="pre">{match.note}</p> : null}
    </article>
  )
}
