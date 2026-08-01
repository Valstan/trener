import config from '@payload-config'
import { getPayload } from 'payload'
import { NextResponse } from 'next/server'

import { isOwner, isCoach } from '@/access/roles'
import { relId } from '@/lib/relId'

// POST { matchId, scoreOur, scoreOpponent, scorers: [{ playerId, goals }] } → внести
// результат существующего матча (обычно будущего из расписания, п.10 аудита; повторный
// вызов перезаписывает счёт — правка опечатки). Владение как в POST /coach/match:
// тренер — только матчи СВОИХ групп, авторы голов — только дети группы матча (152-ФЗ).
export const dynamic = 'force-dynamic'

type ScorerIn = { playerId?: unknown; goals?: unknown }

export const POST = async (req: Request): Promise<Response> => {
  try {
    const payload = await getPayload({ config })
    const { user } = await payload.auth({ headers: req.headers })
    if (!user || !(isCoach(user) || isOwner(user))) return NextResponse.json({ ok: false }, { status: 401 })

    let parsed: { matchId?: unknown; scoreOur?: unknown; scoreOpponent?: unknown; scorers?: unknown } = {}
    try {
      parsed = (await req.json()) as typeof parsed
    } catch {
      // ниже 400
    }

    const { matchId } = parsed
    const scoreOur = Number(parsed.scoreOur)
    const scoreOpponent = Number(parsed.scoreOpponent)
    const validScore = (n: number) => Number.isInteger(n) && n >= 0 && n <= 999
    if (typeof matchId !== 'number' || !validScore(scoreOur) || !validScore(scoreOpponent)) {
      return NextResponse.json({ ok: false }, { status: 400 })
    }

    const match = await payload.findByID({
      collection: 'matches',
      id: matchId,
      depth: 0,
      overrideAccess: true,
      disableErrors: true,
    })
    const groupId = match ? relId(match.group) : null
    if (groupId == null) return NextResponse.json({ ok: false }, { status: 404 })

    // Владение: тренер — только своя группа; админ — любая.
    if (!isOwner(user)) {
      const owned = await payload.find({
        collection: 'groups',
        where: { and: [{ id: { equals: groupId } }, { coaches: { in: [user.id] } }] },
        limit: 1,
        depth: 0,
        pagination: false,
        overrideAccess: true,
      })
      if (!owned.docs.length) return NextResponse.json({ ok: false }, { status: 403 })
    }

    // Авторы голов: только дети группы матча (чужих тихо отбрасываем, как в /coach/match).
    const rawScorers = Array.isArray(parsed.scorers) ? (parsed.scorers as ScorerIn[]) : []
    let scorers: { player: number; goals: number }[] = []
    if (rawScorers.length) {
      const groupPlayers = await payload.find({
        collection: 'players',
        where: { group: { equals: groupId } },
        limit: 1000,
        depth: 0,
        pagination: false,
        overrideAccess: true,
      })
      const validPlayerIds = new Set(groupPlayers.docs.map((p) => p.id))
      scorers = rawScorers
        .map((s) => ({ player: Number(s.playerId), goals: Number(s.goals) }))
        .filter(
          (s) =>
            validPlayerIds.has(s.player) && Number.isInteger(s.goals) && s.goals >= 1 && s.goals <= 99,
        )
    }

    await payload.update({
      collection: 'matches',
      id: matchId,
      data: { scoreOur, scoreOpponent, scorers },
      overrideAccess: true,
    })

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[coach/match/result]', err)
    return NextResponse.json({ ok: false }, { status: 500 })
  }
}
