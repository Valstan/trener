import { describe, it, expect, vi } from 'vitest'
import type { PayloadRequest } from 'payload'

import { coachSessionIds } from './roles'

// coachSessionIds питает scoped-read новых M2-коллекций (Notifications, Rsvps),
// которые привязаны к session, а не к group. Тест фиксирует:
//  • G90: оба служебных find идут с overrideAccess: true (иначе рекурсия через
//    access read коллекций groups/training-sessions);
//  • возвращается плоский список session-id своих групп;
//  • нет групп → пустой список без лишнего find по сессиям.

type FindArgs = { collection: string; overrideAccess?: boolean }

const makeReq = (byCollection: Record<string, { id: number }[]>) => {
  const find = vi.fn(async ({ collection }: FindArgs) => ({
    docs: byCollection[collection] ?? [],
  }))
  const req = { payload: { find } } as unknown as PayloadRequest
  return { req, find }
}

describe('coachSessionIds', () => {
  it('возвращает session-id групп тренера, оба find — overrideAccess (G90)', async () => {
    const { req, find } = makeReq({
      groups: [{ id: 10 }, { id: 11 }],
      'training-sessions': [{ id: 100 }, { id: 101 }, { id: 102 }],
    })

    const ids = await coachSessionIds(req, 7)

    expect(ids).toEqual([100, 101, 102])
    // оба обращения — overrideAccess: true (разрыв G90-рекурсии)
    expect(find).toHaveBeenCalledTimes(2)
    for (const callArgs of find.mock.calls) {
      expect((callArgs[0] as FindArgs).overrideAccess).toBe(true)
    }
    // второй find — по training-sessions, отфильтрован по группам тренера
    expect((find.mock.calls[1][0] as { collection: string; where: unknown }).collection).toBe(
      'training-sessions',
    )
  })

  it('нет групп → пустой список, без find по сессиям', async () => {
    const { req, find } = makeReq({ groups: [], 'training-sessions': [{ id: 100 }] })

    const ids = await coachSessionIds(req, 7)

    expect(ids).toEqual([])
    // только один find (по группам); по сессиям не ходим
    expect(find).toHaveBeenCalledTimes(1)
    expect((find.mock.calls[0][0] as FindArgs).collection).toBe('groups')
  })
})
