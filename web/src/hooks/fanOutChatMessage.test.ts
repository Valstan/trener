import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { PayloadRequest } from 'payload'

import { sendPushToUser } from '../lib/push/send'
import { fanOutChatMessage } from './fanOutChatMessage'

// fanOutChatMessage — пуш остальным участникам комнаты (mock req.payload + mock
// sendPushToUser). Фиксируем:
//  • пуш ТОЛЬКО на create;
//  • адресаты = тренеры группы + родители её детей, БЕЗ автора;
//  • дубли родителя (двое детей в группе) схлопываются в один пуш;
//  • Notifications НЕ создаются (вне coverage);
//  • G90: служебные find — overrideAccess;
//  • падение пуша одному не рвёт рассылку остальным (R5).

vi.mock('../lib/push/send', () => ({ sendPushToUser: vi.fn(async () => 'ok') }))

type AnyArgs = Record<string, unknown>

const makeReq = (coaches: number[], parents: (number | null)[]) => {
  const findByID = vi.fn(async (_args: AnyArgs) => ({ id: 77, coaches }))
  const find = vi.fn(async (_args: AnyArgs) => ({ docs: parents.map((parent, i) => ({ id: i + 1, parent })) }))
  const create = vi.fn(async (_args: AnyArgs) => ({ id: 1 }))
  const logger = { info: vi.fn(), error: vi.fn() }
  const req = { payload: { findByID, find, create, logger } } as unknown as PayloadRequest
  return { req, findByID, find, create, logger }
}

const run = (args: { doc: AnyArgs; operation: 'create' | 'update'; req: PayloadRequest }) =>
  fanOutChatMessage(args as never)

beforeEach(() => {
  vi.mocked(sendPushToUser).mockReset()
  vi.mocked(sendPushToUser).mockImplementation(async () => 'ok' as never)
})

describe('fanOutChatMessage', () => {
  it('create → пуш тренерам и родителям группы, кроме автора', async () => {
    const { req, findByID, find, create } = makeReq([10, 20], [30, 40])
    await run({ doc: { id: 5, group: 77, author: 30 }, operation: 'create', req })

    expect((findByID.mock.calls[0]![0] as AnyArgs).overrideAccess).toBe(true) // G90
    expect((find.mock.calls[0]![0] as AnyArgs).overrideAccess).toBe(true)

    const pushedTo = vi.mocked(sendPushToUser).mock.calls.map((c) => c[1]).sort((a, b) => Number(a) - Number(b))
    expect(pushedTo).toEqual([10, 20, 40]) // автор 30 исключён
    expect(create).not.toHaveBeenCalled() // вне coverage
  })

  it('родитель двоих детей в группе получает один пуш, а не два', async () => {
    const { req } = makeReq([], [55, 55])
    await run({ doc: { id: 5, group: 77, author: 10 }, operation: 'create', req })
    expect(sendPushToUser).toHaveBeenCalledTimes(1)
    expect(vi.mocked(sendPushToUser).mock.calls[0]![1]).toBe(55)
  })

  it('дети без привязанного родителя не ломают рассылку', async () => {
    const { req } = makeReq([10], [null, null])
    await run({ doc: { id: 5, group: 77, author: 99 }, operation: 'create', req })
    expect(sendPushToUser).toHaveBeenCalledTimes(1)
  })

  it('operation=update → пуш не повторяется', async () => {
    const { req, findByID } = makeReq([10], [30])
    await run({ doc: { id: 5, group: 77, author: 1 }, operation: 'update', req })
    expect(findByID).not.toHaveBeenCalled()
    expect(sendPushToUser).not.toHaveBeenCalled()
  })

  it('падение пуша одному адресату не рвёт рассылку остальным', async () => {
    const { req, logger } = makeReq([10, 20], [])
    vi.mocked(sendPushToUser).mockImplementationOnce(async () => {
      throw new Error('подписка протухла')
    })
    await run({ doc: { id: 5, group: 77, author: 99 }, operation: 'create', req })
    expect(sendPushToUser).toHaveBeenCalledTimes(2)
    expect(logger.error).toHaveBeenCalled()
  })

  it('нет адресатов — тихо выходит, не падает', async () => {
    const { req } = makeReq([], [])
    await expect(run({ doc: { id: 5, group: 77, author: 1 }, operation: 'create', req })).resolves.toBeTruthy()
    expect(sendPushToUser).not.toHaveBeenCalled()
  })
})
