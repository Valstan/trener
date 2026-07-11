import type { BasePayload } from 'payload'

import type { MatchView } from '@/app/(frontend)/components/MatchCard'
import { relId } from './relId'

// Минимальная форма match-дока (depth:0), которую отдаёт scoped-find на страницах.
type MatchDoc = {
  id: number
  matchDate?: string | null
  opponent: string
  homeAway?: string | null
  location?: string | null
  scoreOur: number
  scoreOpponent: number
  group?: unknown
  scorers?: { player?: unknown; goals?: number | null }[] | null
  note?: string | null
}

// Разрешает id групп и авторов голов в имена. Имена берём overrideAccess'ом (как
// parent/announcements для имён групп): результат матча ПУБЛИЧЕН внутри группы —
// родитель видит имена детей-авторов, хотя Players.read показал бы лишь его детей.
// 152-ФЗ: тянем ТОЛЬКО имя (минимизация), depth:0.
export const resolveMatchViews = async (
  payload: BasePayload,
  docs: MatchDoc[],
): Promise<MatchView[]> => {
  const groupIds = [...new Set(docs.map((m) => relId(m.group)).filter((v): v is number => v != null))]
  const playerIds = [
    ...new Set(
      docs
        .flatMap((m) => (m.scorers ?? []).map((s) => relId(s.player)))
        .filter((v): v is number => v != null),
    ),
  ]

  const groupNameById = new Map<number, string>()
  if (groupIds.length) {
    const groups = await payload.find({
      collection: 'groups',
      where: { id: { in: groupIds } },
      depth: 0,
      pagination: false,
      overrideAccess: true,
    })
    for (const g of groups.docs) groupNameById.set(g.id, g.name)
  }

  const playerNameById = new Map<number, string>()
  if (playerIds.length) {
    const players = await payload.find({
      collection: 'players',
      where: { id: { in: playerIds } },
      depth: 0,
      pagination: false,
      overrideAccess: true,
    })
    for (const p of players.docs) playerNameById.set(p.id, p.name)
  }

  return docs.map((m) => ({
    id: m.id,
    matchDate: m.matchDate ?? null,
    opponent: m.opponent,
    homeAway: m.homeAway === 'away' ? 'away' : 'home',
    location: m.location ?? null,
    scoreOur: m.scoreOur,
    scoreOpponent: m.scoreOpponent,
    groupName: groupNameById.get(relId(m.group) ?? -1) ?? null,
    scorers: (m.scorers ?? [])
      .map((s) => ({
        name: playerNameById.get(relId(s.player) ?? -1) ?? null,
        goals: typeof s.goals === 'number' && s.goals > 0 ? s.goals : 1,
      }))
      .filter((s): s is { name: string; goals: number } => s.name != null),
    note: m.note ?? null,
  }))
}
