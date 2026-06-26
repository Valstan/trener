import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { PayloadRequest } from 'payload'

import { sendPushToUser } from '../lib/push/send'
import { fanOutQuestion } from './fanOutQuestion'

// fanOutQuestion — фан-аут вопроса родителя тренерам группы (mock req.payload + mock
// sendPushToUser). Фиксируем:
//  • пуш ТОЛЬКО на create;
//  • один пуш на каждого тренера группы (мульти-тренер);
//  • Notifications НЕ создаются (вне coverage);
//  • G90: findByID группы — overrideAccess.

vi.mock('../lib/push/send', () => ({ sendPushToUser: vi.fn(async () => 'ok') }))

type AnyArgs = Record<string, unknown>

const makeReq = (coaches: number[]) => {
  const findByID = vi.fn(async (_args: AnyArgs) => ({ id: 77, coaches }))
  const create = vi.fn(async (_args: AnyArgs) => ({ id: 1 }))
  const logger = { info: vi.fn(), error: vi.fn() }
  const req = { payload: { findByID, create, logger } } as unknown as PayloadRequest
  return { req, findByID, create }
}

const run = (args: { doc: AnyArgs; operation: 'create' | 'update'; req: PayloadRequest }) => fanOutQuestion(args as never)

beforeEach(() => {
  vi.mocked(sendPushToUser).mockClear()
})

describe('fanOutQuestion', () => {
  it('create → пуш каждому тренеру группы, Notifications не создаются', async () => {
    const { req, findByID, create } = makeReq([10, 20])
    await run({ doc: { id: 5, group: 77 }, operation: 'create', req })

    expect(findByID).toHaveBeenCalledOnce()
    expect((findByID.mock.calls[0][0] as AnyArgs).overrideAccess).toBe(true) // G90

    expect(sendPushToUser).toHaveBeenCalledTimes(2)
    const pushedTo = vi.mocked(sendPushToUser).mock.calls.map((c) => c[1]).sort()
    expect(pushedTo).toEqual([10, 20])

    expect(create).not.toHaveBeenCalled() // вне coverage
  })

  it('operation=update → пуш не повторяется', async () => {
    const { req, findByID } = makeReq([10])
    await run({ doc: { id: 5, group: 77 }, operation: 'update', req })
    expect(findByID).not.toHaveBeenCalled()
    expect(sendPushToUser).not.toHaveBeenCalled()
  })

  it('у группы нет тренеров → пуша нет, не падает', async () => {
    const { req } = makeReq([])
    await run({ doc: { id: 5, group: 77 }, operation: 'create', req })
    expect(sendPushToUser).not.toHaveBeenCalled()
  })
})
