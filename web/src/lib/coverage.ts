import type { Payload, PayloadRequest } from 'payload'

import type { Player, TrainingSession, User } from '@/payload-types'
import { coachGroupIds, isAdmin } from '@/access/roles'
import { relId } from '@/lib/relId'

// Может ли пользователь видеть coverage этой сессии: админ — любую; тренер — только
// сессии своих групп (#015). Гейт владения для coverage-эндпоинта и /coach-страниц.
export const coachCanSeeSession = async (
  payload: Payload,
  user: Pick<User, 'id' | 'roles'>,
  session: TrainingSession,
): Promise<boolean> => {
  if (isAdmin(user)) return true
  const groupIds = await coachGroupIds({ payload } as unknown as PayloadRequest, user.id)
  return groupIds.includes(relId(session.group) ?? -1)
}

// Coverage «приняли N из M» (kickoff §6/§8) — мера доведения текущей волны изменения.
// N = родители, подтвердившие (acked); M = родители, которым волна ушла (= по одному
// Notification на родителя за волну, H4). Только ТЕКУЩАЯ волна (changedAt == session,
// C2): ack старой правки за новую не засчитывается.
//
// Достижимость (pool #059 от brain): отдельно считаем «недостижимых» — детей группы
// БЕЗ привязанного родителя. До них волна не дошла вообще (некому слать), это не
// «не принял», а «нет канала» — тренеру видно, что нужно завести аккаунт родителя.

type CoverageStatus = 'delivered' | 'seen' | 'acked'

export type CoverageEntry = {
  parentId: number
  parentName: string
  childNames: string[]
  status: CoverageStatus
}

export type CoverageSummary = {
  total: number // M — родителей в текущей волне
  acked: number // N — подтвердили
  seen: number // открыли, но не подтвердили
  delivered: number // ещё не открывали
  pending: CoverageEntry[] // не подтвердили — кому напомнить/позвонить (H3: тренер сам)
  done: CoverageEntry[] // подтвердили
}

// Чистая агрегация (юнит-тестируемая). На вход — записи текущей волны.
export const buildCoverage = (entries: CoverageEntry[]): CoverageSummary => {
  const acked = entries.filter((e) => e.status === 'acked')
  const seen = entries.filter((e) => e.status === 'seen')
  const delivered = entries.filter((e) => e.status === 'delivered')
  return {
    total: entries.length,
    acked: acked.length,
    seen: seen.length,
    delivered: delivered.length,
    // «не открыл» холоднее «открыл, но молчит» → выше в списке на обзвон
    pending: [...delivered, ...seen],
    done: acked,
  }
}

export type CoverageResult = {
  wave: string | null // changedAt текущей волны; null → изменений нет, нечего подтверждать
  summary: CoverageSummary
  unreachable: number // дети группы без родителя — до них канал не дошёл (#059)
}

// Серверная сборка coverage по сессии (queries + агрегация). overrideAccess —
// служебное чтение, гейт владения делает вызывающий эндпоинт/страница.
export const loadCoverage = async (payload: Payload, session: TrainingSession): Promise<CoverageResult> => {
  const groupId = relId(session.group)
  const wave = session.changedAt ?? null

  const unreachable =
    groupId == null
      ? 0
      : (
          await payload.find({
            collection: 'players',
            where: { and: [{ group: { equals: groupId } }, { parent: { exists: false } }] },
            depth: 0,
            pagination: false,
            overrideAccess: true,
          })
        ).docs.length

  if (!wave) return { wave: null, summary: buildCoverage([]), unreachable }

  const notifs = await payload.find({
    collection: 'notifications',
    where: { and: [{ session: { equals: session.id } }, { changedAt: { equals: wave } }] },
    depth: 0,
    pagination: false,
    overrideAccess: true,
  })

  const parentIds = [...new Set(notifs.docs.map((n) => relId(n.parent)).filter((v): v is number => v != null))]
  const playerIds = [
    ...new Set(
      notifs.docs.flatMap((n) => ((n.players as (number | Player)[]) ?? []).map(relId)).filter((v): v is number => v != null),
    ),
  ]

  const [parents, players] = await Promise.all([
    parentIds.length
      ? payload
          .find({ collection: 'users', where: { id: { in: parentIds } }, depth: 0, pagination: false, overrideAccess: true })
          .then((r) => r.docs)
      : Promise.resolve<User[]>([]),
    playerIds.length
      ? payload
          .find({ collection: 'players', where: { id: { in: playerIds } }, depth: 0, pagination: false, overrideAccess: true })
          .then((r) => r.docs)
      : Promise.resolve<Player[]>([]),
  ])

  const parentNameById = new Map(parents.map((p) => [p.id, p.name || p.email]))
  const playerNameById = new Map(players.map((p) => [p.id, p.name]))

  const entries: CoverageEntry[] = notifs.docs
    .map((n) => {
      const parentId = relId(n.parent)
      if (parentId == null) return null
      const childNames = ((n.players as (number | Player)[]) ?? [])
        .map((p) => playerNameById.get(relId(p) ?? -1))
        .filter((name): name is string => Boolean(name))
      const status = n.status === 'acked' || n.status === 'seen' ? n.status : 'delivered'
      return { parentId, parentName: parentNameById.get(parentId) ?? `#${parentId}`, childNames, status }
    })
    .filter((e): e is CoverageEntry => e !== null)

  return { wave, summary: buildCoverage(entries), unreachable }
}
