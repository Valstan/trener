import { describe, it, expect, vi } from 'vitest'
import type { PayloadRequest } from 'payload'

import { cleanupTopicRelations } from './cleanupTopicRelations'

// M9: удаление темы чистит её сообщения ДО удаления родителя — FK ON DELETE SET NULL
// ⨯ NOT NULL topic заблокировал бы DELETE (та же грабля, что в cleanupSessionRelations).

type AnyArgs = Record<string, unknown>

describe('cleanupTopicRelations', () => {
  it('удаляет сообщения И отметки прочтения темы, overrideAccess', async () => {
    const del = vi.fn(async (_args: AnyArgs) => ({ docs: [] }))
    const logger = { error: vi.fn() }
    const req = { payload: { delete: del, logger } } as unknown as PayloadRequest

    await cleanupTopicRelations({ id: 7, req } as never)

    expect(del).toHaveBeenCalledTimes(2)
    const colls = del.mock.calls.map((c) => (c[0] as AnyArgs).collection)
    expect(colls).toEqual(['chat-messages', 'chat-reads'])
    for (const c of del.mock.calls) {
      expect((c[0] as AnyArgs).where).toEqual({ topic: { equals: 7 } })
      expect((c[0] as AnyArgs).overrideAccess).toBe(true)
    }
  })

  it('падение очистки не роняет удаление — только лог', async () => {
    const del = vi.fn(async () => {
      throw new Error('БД недоступна')
    })
    const logger = { error: vi.fn() }
    const req = { payload: { delete: del, logger } } as unknown as PayloadRequest

    await expect(cleanupTopicRelations({ id: 7, req } as never)).resolves.toBeUndefined()
    // Обе коллекции пробуются независимо: падение первой не отменяет вторую.
    expect(del).toHaveBeenCalledTimes(2)
    expect(logger.error).toHaveBeenCalledTimes(2)
  })
})
