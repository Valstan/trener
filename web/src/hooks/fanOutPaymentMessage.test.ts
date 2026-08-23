import { describe, expect, it, vi } from 'vitest'

import { fanOutPaymentMessage } from './fanOutPaymentMessage'

// Фан-аут платёжного сообщения. Ключевая проверка изоляции демо (D-029/#166):
// сообщение демо-гостя (demoGuest:true) не должно уведомлять НИКОГО — получатели
// здесь глобальные `roles:['owner']`, среди них живой владелец, которого
// sendPushToUser НЕ режет (он проверяет только адресата, а живой owner не demo).

const makeReq = (findDocs: { id: number }[]) => {
  const find = vi.fn(async () => ({ docs: findDocs }))
  const findByID = vi.fn(async () => ({ id: 1, parent: 9, branch: 3 }))
  const logger = { error: vi.fn(), info: vi.fn() }
  return { req: { payload: { find, findByID, logger } } as never, find, findByID }
}

describe('fanOutPaymentMessage — изоляция демо', () => {
  it('demoGuest:true → ни одного похода за получателями, ни одного пуша', async () => {
    const { req, find, findByID } = makeReq([{ id: 1 }, { id: 2 }])

    const out = await fanOutPaymentMessage({
      doc: { thread: 1, author: 5, authorRole: 'parent', demoGuest: true },
      operation: 'create',
      req,
    } as never)

    expect(out).toEqual({ thread: 1, author: 5, authorRole: 'parent', demoGuest: true })
    expect(findByID).not.toHaveBeenCalled() // вышли до чтения нити
    expect(find).not.toHaveBeenCalled() // и до поиска владельцев
  })

  it('обычное сообщение (без demoGuest) — фан-аут идёт (нить читается)', async () => {
    const { req, findByID } = makeReq([])

    await fanOutPaymentMessage({
      doc: { thread: 1, author: 5, authorRole: 'parent' },
      operation: 'create',
      req,
    } as never)

    expect(findByID).toHaveBeenCalledOnce() // дошли до чтения нити
  })

  it('operation !== create — no-op', async () => {
    const { req, findByID } = makeReq([])
    await fanOutPaymentMessage({ doc: { thread: 1 }, operation: 'update', req } as never)
    expect(findByID).not.toHaveBeenCalled()
  })
})
