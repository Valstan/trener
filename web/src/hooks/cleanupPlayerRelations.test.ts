import { describe, it, expect, vi } from 'vitest'
import type { PayloadRequest } from 'payload'

import { cleanupPlayerRelations } from './cleanupPlayerRelations'

// FK ON DELETE SET NULL ⨯ NOT NULL rsvps.player: без чистки DELETE ребёнка
// откатывается. login-tokens гасим, чтобы не жила join-ссылка удалённого ребёнка.
// matches.scorers: вычищаем ребёнка из авторов голов (иначе строка «гол — (пусто)»).

type AnyArgs = Record<string, unknown>

const mkReq = (opts: {
  del?: ReturnType<typeof vi.fn>
  find?: ReturnType<typeof vi.fn>
  update?: ReturnType<typeof vi.fn>
} = {}) => {
  const del = opts.del ?? vi.fn(async (_a: AnyArgs) => ({ docs: [] }))
  const find = opts.find ?? vi.fn(async (_a: AnyArgs) => ({ docs: [] }))
  const update = opts.update ?? vi.fn(async (_a: AnyArgs) => ({}))
  const logger = { error: vi.fn(), info: vi.fn() }
  const req = { payload: { delete: del, find, update, logger } } as unknown as PayloadRequest
  return { req, del, find, update, logger }
}

describe('cleanupPlayerRelations', () => {
  it('удаляет rsvps и login-tokens ребёнка, overrideAccess', async () => {
    const { req, del } = mkReq()

    await cleanupPlayerRelations({ id: 7, req } as never)

    const colls = del.mock.calls.map((c) => (c[0] as AnyArgs).collection)
    expect(colls).toEqual(expect.arrayContaining(['rsvps', 'login-tokens']))
    for (const c of del.mock.calls) {
      expect((c[0] as AnyArgs).where).toEqual({ player: { equals: 7 } })
      expect((c[0] as AnyArgs).overrideAccess).toBe(true)
    }
  })

  it('вычищает ребёнка из авторов голов матчей, сохраняя прочих', async () => {
    const find = vi.fn(async (_a: AnyArgs) => ({
      docs: [
        {
          id: 5,
          scorers: [
            { player: 7, goals: 2 },
            { player: 9, goals: 1 },
          ],
        },
      ],
    }))
    const { req, update } = mkReq({ find })

    await cleanupPlayerRelations({ id: 7, req } as never)

    expect(find.mock.calls[0][0]).toMatchObject({
      collection: 'matches',
      where: { 'scorers.player': { equals: 7 } },
      overrideAccess: true,
    })
    expect(update).toHaveBeenCalledTimes(1)
    const arg = update.mock.calls[0][0] as AnyArgs
    expect(arg.collection).toBe('matches')
    expect(arg.id).toBe(5)
    expect((arg.data as AnyArgs).scorers).toEqual([{ player: 9, goals: 1 }])
  })

  it('ошибка одной коллекции не прерывает чистку остальных', async () => {
    const del = vi
      .fn(async (_a: AnyArgs) => ({ docs: [] }))
      .mockRejectedValueOnce(new Error('boom'))
    const { req, logger } = mkReq({ del })

    await cleanupPlayerRelations({ id: 7, req } as never)

    expect(del).toHaveBeenCalledTimes(2)
    expect(logger.error).toHaveBeenCalledTimes(1)
  })
})
