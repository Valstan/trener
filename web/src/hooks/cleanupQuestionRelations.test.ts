import { describe, it, expect, vi } from 'vitest'
import type { PayloadRequest } from 'payload'

import { cleanupQuestionRelations } from './cleanupQuestionRelations'

// Удаление вопроса (головы нитки M4) каскадно чистит его question-messages
// (FK required ⨯ ON DELETE SET NULL заблокировал бы DELETE головы). Ошибка чистки
// логируется, не бросается.

type AnyArgs = Record<string, unknown>

describe('cleanupQuestionRelations', () => {
  it('удаляет реплики нитки, overrideAccess', async () => {
    const del = vi.fn(async (_args: AnyArgs) => ({ docs: [] }))
    const logger = { error: vi.fn() }
    const req = { payload: { delete: del, logger } } as unknown as PayloadRequest

    await cleanupQuestionRelations({ id: 42, req } as never)

    expect(del).toHaveBeenCalledOnce()
    expect(del.mock.calls[0][0]).toMatchObject({
      collection: 'question-messages',
      where: { question: { equals: 42 } },
      overrideAccess: true,
    })
  })

  it('ошибка чистки не бросается наружу', async () => {
    const del = vi.fn(async () => {
      throw new Error('db down')
    })
    const logger = { error: vi.fn() }
    const req = { payload: { delete: del, logger } } as unknown as PayloadRequest

    await expect(cleanupQuestionRelations({ id: 42, req } as never)).resolves.toBeUndefined()
    expect(logger.error).toHaveBeenCalledOnce()
  })
})
