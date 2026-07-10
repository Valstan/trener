import { describe, it, expect, vi } from 'vitest'
import type { PayloadRequest } from 'payload'

import { cleanupUserRelations } from './cleanupUserRelations'

// FK ON DELETE SET NULL ⨯ NOT NULL (rsvps/notifications.parent, devices.user,
// questions.parent, consents.parent): без чистки DELETE пользователя откатывается.
// players.parent НЕ трогаем (nullable — ребёнок остаётся, SET NULL сам).

type AnyArgs = Record<string, unknown>

describe('cleanupUserRelations', () => {
  it('чистит все зависимые коллекции по правильным полям, overrideAccess', async () => {
    const del = vi.fn(async (_args: AnyArgs) => ({ docs: [] }))
    const logger = { error: vi.fn(), info: vi.fn() }
    const req = { payload: { delete: del, logger } } as unknown as PayloadRequest

    await cleanupUserRelations({ id: 3, req } as never)

    const byCollection = Object.fromEntries(
      del.mock.calls.map((c) => [(c[0] as AnyArgs).collection, (c[0] as AnyArgs).where]),
    )
    expect(byCollection).toEqual({
      rsvps: { parent: { equals: 3 } },
      notifications: { parent: { equals: 3 } },
      devices: { user: { equals: 3 } },
      questions: { parent: { equals: 3 } },
      consents: { parent: { equals: 3 } },
      'login-tokens': { user: { equals: 3 } },
    })
    for (const c of del.mock.calls) expect((c[0] as AnyArgs).overrideAccess).toBe(true)
    // players НЕ удаляются (ребёнок остаётся в группе)
    expect(Object.keys(byCollection)).not.toContain('players')
  })

  it('удаление согласий логируется (бумага — источник истины)', async () => {
    const del = vi.fn(async (_args: AnyArgs) => ({ docs: [] }))
    const logger = { error: vi.fn(), info: vi.fn() }
    const req = { payload: { delete: del, logger } } as unknown as PayloadRequest

    await cleanupUserRelations({ id: 3, req } as never)

    expect(logger.info).toHaveBeenCalledTimes(1)
  })

  it('ошибка одной коллекции не прерывает чистку остальных', async () => {
    const del = vi
      .fn(async (_args: AnyArgs) => ({ docs: [] }))
      .mockRejectedValueOnce(new Error('boom'))
    const logger = { error: vi.fn(), info: vi.fn() }
    const req = { payload: { delete: del, logger } } as unknown as PayloadRequest

    await cleanupUserRelations({ id: 3, req } as never)

    expect(del).toHaveBeenCalledTimes(6)
    expect(logger.error).toHaveBeenCalledTimes(1)
  })
})
