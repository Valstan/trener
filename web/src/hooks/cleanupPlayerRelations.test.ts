import { describe, it, expect, vi } from 'vitest'
import type { PayloadRequest } from 'payload'

import { cleanupPlayerRelations } from './cleanupPlayerRelations'

// FK ON DELETE SET NULL ⨯ NOT NULL rsvps.player: без чистки DELETE ребёнка
// откатывается. login-tokens гасим, чтобы не жила join-ссылка удалённого ребёнка.

type AnyArgs = Record<string, unknown>

describe('cleanupPlayerRelations', () => {
  it('удаляет rsvps и login-tokens ребёнка, overrideAccess', async () => {
    const del = vi.fn(async (_args: AnyArgs) => ({ docs: [] }))
    const logger = { error: vi.fn(), info: vi.fn() }
    const req = { payload: { delete: del, logger } } as unknown as PayloadRequest

    await cleanupPlayerRelations({ id: 7, req } as never)

    const colls = del.mock.calls.map((c) => (c[0] as AnyArgs).collection)
    expect(colls).toEqual(expect.arrayContaining(['rsvps', 'login-tokens']))
    for (const c of del.mock.calls) {
      expect((c[0] as AnyArgs).where).toEqual({ player: { equals: 7 } })
      expect((c[0] as AnyArgs).overrideAccess).toBe(true)
    }
  })

  it('ошибка одной коллекции не прерывает чистку остальных', async () => {
    const del = vi
      .fn(async (_args: AnyArgs) => ({ docs: [] }))
      .mockRejectedValueOnce(new Error('boom'))
    const logger = { error: vi.fn(), info: vi.fn() }
    const req = { payload: { delete: del, logger } } as unknown as PayloadRequest

    await cleanupPlayerRelations({ id: 7, req } as never)

    expect(del).toHaveBeenCalledTimes(2)
    expect(logger.error).toHaveBeenCalledTimes(1)
  })
})
