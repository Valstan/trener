import { describe, it, expect, vi } from 'vitest'
import type { BasePayload } from 'payload'

import { resolveMatchViews } from './matches'

// resolveMatchViews разрешает id групп/авторов в имена overrideAccess'ом (публикация
// результата внутри группы; 152-ФЗ: только имя). Проверяем маппинг и отсев пустых.

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
})
