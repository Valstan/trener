import type { BasePayload } from 'payload'

import type { MatchView } from '@/app/(frontend)/components/MatchCard'
import { relId } from './relId'

// Минимальная форма match-дока (depth:0), которую отдаёт scoped-find на страницах.
// Счёт опционален: оба поля пустые = будущий матч (расписание, видение §3.1).
type MatchDoc = {
  id: number
  matchDate?: string | null
  opponent: string
  homeAway?: string | null
  location?: string | null
  scoreOur?: number | null
  scoreOpponent?: number | null
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
    scoreOur: m.scoreOur ?? null,
    scoreOpponent: m.scoreOpponent ?? null,
    groupId: relId(m.group) ?? null,
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

// Правило «гол может забить только ребёнок из группы этого матча» (#057, векторы b, f).
//
// ПОЧЕМУ здесь, а не в validate вложенного поля `scorers[].player`: правилу нужен
// `group` МАТЧА, а `siblingData` у поля внутри массива в payload 3.90.1 не содержит
// полей родительского объекта. Проверено на живом сиде (03.10): валидатор на вложенном
// поле получал group = null и отвергал ЛЮБУЮ запись гола — «Сначала укажите группу
// матча», то есть тренер не мог записать результат. У validate уровня массива
// `siblingData` —Sibling поля матча, и там проверка работает.
//
// Возвращает true либо текст ошибки — сигнатура как у `validate` в конфиге поля.
export const validateScorersGroup = (
  scorers: unknown,
  matchGroup: unknown,
  playerGroupById: ReadonlyMap<number, number | null>,
): true | string => {
  if (!Array.isArray(scorers) || scorers.length === 0) return true
  const groupId =
    matchGroup != null && typeof matchGroup === 'object'
      ? ((matchGroup as { id?: number | string }).id ?? null)
      : ((matchGroup as number | string | null | undefined) ?? null)
  if (groupId == null) return 'Сначала укажите группу матча.'
  for (const row of scorers as { player?: unknown }[]) {
    const playerId = relId(row?.player)
    if (playerId == null) continue
    const playerGroup = playerGroupById.get(playerId) ?? null
    if (Number(playerGroup) !== Number(groupId)) {
      return 'Гол может забить только ребёнок из группы этого матча.'
    }
  }
  return true
}

// Сыгран = счёт заполнен целиком. Вычисляется из данных, не из флага.
const isPlayed = (m: Pick<MatchView, 'scoreOur' | 'scoreOpponent'>): boolean =>
  m.scoreOur != null && m.scoreOpponent != null

// Дележ ленты «-matchDate»: несыгранные — ближайшие сверху (разворот), сыгранные —
// свежие сверху (порядок входа). Прошедший матч без счёта остаётся в «предстоящих» —
// это напоминание тренеру внести результат, а не результат.
export const splitMatchViews = (views: MatchView[]): { upcoming: MatchView[]; played: MatchView[] } => {
  const upcoming: MatchView[] = []
  const played: MatchView[] = []
  for (const v of views) (isPlayed(v) ? played : upcoming).push(v)
  upcoming.reverse()
  return { upcoming, played }
}
