import { describe, it, expect, vi } from 'vitest'
import type { PayloadRequest } from 'payload'

import { cleanupSessionRelations } from './cleanupSessionRelations'

// C3: удаление сессии каскадно чистит её notifications и rsvps (overrideAccess),
// чтобы inbox/coverage не натыкались на «мёртвую» ссылку session.

type AnyArgs = Record<string, unknown>

describe('cleanupSessionRelations', () => {
  it('удаляет notifications и rsvps удалённой сессии, overrideAccess', async () => {
    const del = vi.fn(async (_args: AnyArgs) => ({ docs: [] }))
    const logger = { error: vi.fn() }
    const req = { payload: { delete: del, logger } } as unknown as PayloadRequest

    await cleanupSessionRelations({ id: 42, req } as never)

    expect(del).toHaveBeenCalledTimes(2)
    const colls = del.mock.calls.map((c) => (c[0] as AnyArgs).collection)
    expect(colls).toContain('notifications')
    expect(colls).toContain('rsvps')
    for (const c of del.mock.calls) {
      expect((c[0] as AnyArgs).where).toEqual({ session: { equals: 42 } })
      expect((c[0] as AnyArgs).overrideAccess).toBe(true)
    }
  })
})
