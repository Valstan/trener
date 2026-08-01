import { describe, it, expect, vi } from 'vitest'
import type { BasePayload } from 'payload'

import { resolveMatchViews, splitMatchViews } from './matches'
import type { MatchView } from '@/app/(frontend)/components/MatchCard'

// resolveMatchViews разрешает id групп/авторов в имена overrideAccess'ом (публикация
// результата внутри группы; 152-ФЗ: только имя). Проверяем маппинг и отсев пустых.
// splitMatchViews делит ленту на предстоящие/сыгранные по заполненности счёта (п.10).

type AnyArgs = Record<string, unknown>

const mkPayload = () => {
  const find = vi.fn(async (args: AnyArgs) => {
    if (args.collection === 'groups') return { docs: [{ id: 1, name: 'U-10' }] }
    if (args.collection === 'players')
      return { docs: [{ id: 7, name: 'Петя' }, { id: 9, name: 'Вася' }] }
    return { docs: [] }
  })
  return { find } as unknown as BasePayload & { find: typeof find }
}

describe('resolveMatchViews', () => {
  it('разрешает группу и авторов голов в имена, home/away нормализуется', async () => {
    const payload = mkPayload()
    const views = await resolveMatchViews(payload, [
      {
        id: 5,
        matchDate: '2026-07-01T10:00:00.000Z',
        opponent: 'Спартак',
        homeAway: 'away',
        scoreOur: 3,
        scoreOpponent: 1,
        group: 1,
        scorers: [
          { player: 7, goals: 2 },
          { player: 9, goals: 1 },
        ],
      },
    ])

    expect(views).toHaveLength(1)
    const v = views[0]
    expect(v.groupName).toBe('U-10')
    expect(v.homeAway).toBe('away')
    expect(v.scorers).toEqual([
      { name: 'Петя', goals: 2 },
      { name: 'Вася', goals: 1 },
    ])
    // overrideAccess при разрешении имён — обязателен (родитель видит чужих авторов).
    expect(payload.find).toHaveBeenCalledWith(expect.objectContaining({ overrideAccess: true }))
  })

  it('отсеивает автора без разрешённого имени и дефолтит homeAway в home', async () => {
    const payload = mkPayload()
    const views = await resolveMatchViews(payload, [
      {
        id: 6,
        matchDate: null,
        opponent: 'Динамо',
        homeAway: null,
        scoreOur: 0,
        scoreOpponent: 0,
        group: 1,
        scorers: [{ player: 999, goals: 1 }],
      },
    ])

    expect(views[0].homeAway).toBe('home')
    expect(views[0].scorers).toEqual([])
  })

  it('пустой счёт (будущий матч) остаётся null-парой, groupId пробрасывается', async () => {
    const payload = mkPayload()
    const views = await resolveMatchViews(payload, [
      {
        id: 7,
        matchDate: '2026-09-01T10:00:00.000Z',
        opponent: 'Зенит',
        homeAway: 'home',
        group: 1,
        scorers: [],
      },
    ])

    expect(views[0].scoreOur).toBeNull()
    expect(views[0].scoreOpponent).toBeNull()
    expect(views[0].groupId).toBe(1)
  })
})

describe('splitMatchViews', () => {
  const mk = (id: number, date: string, score: [number, number] | null): MatchView => ({
    id,
    matchDate: date,
    opponent: 'X',
    homeAway: 'home',
    scoreOur: score ? score[0] : null,
    scoreOpponent: score ? score[1] : null,
    groupId: 1,
    scorers: [],
  })

  it('делит по заполненности счёта: предстоящие ближайшие сверху, сыгранные свежие сверху', () => {
    // Вход отсортирован «-matchDate», как отдают страницы.
    const input = [
      mk(1, '2026-09-10T10:00:00.000Z', null), // дальний будущий
      mk(2, '2026-09-01T10:00:00.000Z', null), // ближний будущий
      mk(3, '2026-07-20T10:00:00.000Z', [2, 1]), // свежий сыгранный
      mk(4, '2026-07-01T10:00:00.000Z', [0, 3]), // старый сыгранный
    ]

    const { upcoming, played } = splitMatchViews(input)

    expect(upcoming.map((m) => m.id)).toEqual([2, 1]) // ближайший первым
    expect(played.map((m) => m.id)).toEqual([3, 4]) // свежий первым
  })

  it('половина счёта не считается сыгранным (страховка от кривых данных)', () => {
    const half = { ...mk(5, '2026-07-01T10:00:00.000Z', [1, 0]), scoreOpponent: null }
    const { upcoming, played } = splitMatchViews([half])

    expect(played).toHaveLength(0)
    expect(upcoming).toHaveLength(1)
  })
})
