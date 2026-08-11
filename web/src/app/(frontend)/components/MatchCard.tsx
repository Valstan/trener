import React from 'react'
import Link from 'next/link'
import Image from 'next/image'

import { formatDateTime } from '@/lib/notifications/describe'

// Карточка матча (будущего или сыгранного) — общий презентационный компонент для лент
// тренера и родителя. Server-only (данные уже нормализованы вызывающей страницей: имена
// групп и авторов голов разрезолвлены через overrideAccess, 152-ФЗ: только имя ребёнка).
// Счёт пуст (оба поля) = матч предстоит: вместо счёта и исхода — «Предстоит».
export type MatchView = {
  id: number
  matchDate: string | null
  opponent: string
  homeAway: 'home' | 'away'
  location?: string | null
  scoreOur: number | null
  scoreOpponent: number | null
  groupId: number | null
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

const opponentCrests = [
  '/football-mode/crest-lightning.png',
  '/football-mode/crest-lynx.png',
  '/football-mode/crest-wings.png',
]

const opponentCrest = (opponent: string): string => {
  const score = Array.from(opponent).reduce((sum, char) => sum + char.codePointAt(0)!, 0)
  return opponentCrests[score % opponentCrests.length]
}

export const MatchCard = ({
  match,
  showCommentsLink = true,
}: {
  match: MatchView
  showCommentsLink?: boolean
}) => {
  const played = match.scoreOur != null && match.scoreOpponent != null
  const res = played ? outcome(match.scoreOur as number, match.scoreOpponent as number) : null
  return (
    <article className="card stack-sm match-card">
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
        <strong className="match-team match-team-home" style={{ flex: 1 }}>
          <Image
            className="match-crest"
            src="/football-mode/crest-firebird.png"
            width={42}
            height={42}
            alt=""
            aria-hidden
          />
          <span>Наши</span>
        </strong>
        {res ? (
          <span className={`match-score match-${res.cls}`}>
            {match.scoreOur} : {match.scoreOpponent}
          </span>
        ) : (
          <span className="match-score match-upcoming">vs</span>
        )}
        <strong className="match-team match-team-away" style={{ flex: 1, textAlign: 'right' }}>
          <span>{match.opponent}</span>
          <Image
            className="match-crest"
            src={opponentCrest(match.opponent)}
            width={42}
            height={42}
            alt=""
            aria-hidden
          />
        </strong>
      </div>
      <div className="muted small" style={{ textAlign: 'center' }}>
        {res ? res.label : 'Предстоит'}
      </div>

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
      {showCommentsLink && (
        <Link className="btn btn-ghost btn-block" href={`/match/${match.id}`}>
          Открыть матч и комментарии →
        </Link>
      )}
    </article>
  )
}
