import config from '@payload-config'
import { getPayload } from 'payload'
import { NextResponse } from 'next/server'

import { isOwner, isCoach } from '@/access/roles'

// POST { groupId, matchDate, opponent, homeAway, location?, scoreOur?, scoreOpponent?,
//        scorers: [{ playerId, goals }], note? } → матч (дорожная карта §4, видение §3.1).
// Счёт — парой или никак: оба поля есть = сыгранный (результат), оба отсутствуют =
// будущий матч (расписание); авторы голов допустимы только со счётом.
// Информационный канал (как объявление): создаём через local API с overrideAccess,
// но #015-владение проверяем руками — тренер заводит ТОЛЬКО свои группы, а каждый
// автор гола ДОЛЖЕН принадлежать этой группе (152-ФЗ: не протащить чужого ребёнка).
export const dynamic = 'force-dynamic'

type ScorerIn = { playerId?: unknown; goals?: unknown }

export const POST = async (req: Request): Promise<Response> => {
  try {
    const payload = await getPayload({ config })
    const { user } = await payload.auth({ headers: req.headers })
    if (!user || !(isCoach(user) || isOwner(user))) return NextResponse.json({ ok: false }, { status: 401 })

    let parsed: {
      groupId?: unknown
      matchDate?: unknown
      opponent?: unknown
      homeAway?: unknown
      location?: unknown
      scoreOur?: unknown
      scoreOpponent?: unknown
      scorers?: unknown
      note?: unknown
    } = {}
    try {
      parsed = (await req.json()) as typeof parsed
    } catch {
      // ниже 400
    }

    const { groupId } = parsed
    const opponent = typeof parsed.opponent === 'string' ? parsed.opponent.trim() : ''
    const matchDate = typeof parsed.matchDate === 'string' ? parsed.matchDate : ''
    const homeAway = parsed.homeAway === 'away' ? 'away' : 'home'
    const location = typeof parsed.location === 'string' ? parsed.location.trim() : ''
    const note = typeof parsed.note === 'string' ? parsed.note.trim() : ''
    // Счёт парой или никак: «есть» = хоть одно поле прислано непустым.
    const hasScore = parsed.scoreOur != null || parsed.scoreOpponent != null
    const scoreOur = hasScore ? Number(parsed.scoreOur) : null
    const scoreOpponent = hasScore ? Number(parsed.scoreOpponent) : null

    const validScore = (n: number) => Number.isInteger(n) && n >= 0 && n <= 999
    if (
      typeof groupId !== 'number' ||
      !opponent ||
      !matchDate ||
      Number.isNaN(Date.parse(matchDate)) ||
      (hasScore && (!validScore(scoreOur as number) || !validScore(scoreOpponent as number)))
    ) {
      return NextResponse.json({ ok: false }, { status: 400 })
    }

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

    // Авторы голов: только у сыгранного матча и только дети ЭТОЙ группы (иначе тихо
    // отбрасываем — не 400, чтобы гонка «ребёнка перевели» не роняла сохранение).
    const rawScorers = hasScore && Array.isArray(parsed.scorers) ? (parsed.scorers as ScorerIn[]) : []
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

    await payload.create({
      collection: 'matches',
      data: {
        group: groupId,
        matchDate,
        opponent,
        homeAway,
        location: location || undefined,
        scoreOur: scoreOur ?? undefined,
        scoreOpponent: scoreOpponent ?? undefined,
        scorers,
        note: note || undefined,
      },
      overrideAccess: true,
    })

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[coach/match]', err)
    return NextResponse.json({ ok: false }, { status: 500 })
  }
}
