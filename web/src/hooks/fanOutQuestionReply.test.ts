import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { PayloadRequest } from 'payload'

import { buildQuestionMessage, buildQuestionReplyMessage } from '../lib/push/message'
import { sendPushToUser } from '../lib/push/send'
import { fanOutQuestionReply } from './fanOutQuestionReply'

// fanOutQuestionReply — фан-аут реплики нитки M4 по направлению автора:
//  • coach → один пуш родителю нитки (buildQuestionReplyMessage), группу не дёргаем;
//  • parent → пуш каждому тренеру группы (как у головы нитки);
//  • только на create; ошибки пуша не валят создание.

vi.mock('../lib/push/send', () => ({ sendPushToUser: vi.fn(async () => 'ok') }))

type AnyArgs = Record<string, unknown>

const makeReq = (coaches: number[]) => {
  const findByID = vi.fn(async (_args: AnyArgs) => ({ id: 77, coaches }))
  const logger = { info: vi.fn(), error: vi.fn() }
  const req = { payload: { findByID, logger } } as unknown as PayloadRequest
  return { req, findByID }
}

const run = (args: { doc: AnyArgs; operation: 'create' | 'update'; req: PayloadRequest }) =>
  fanOutQuestionReply(args as never)

beforeEach(() => {
  vi.mocked(sendPushToUser).mockClear()
})

describe('fanOutQuestionReply', () => {
  it('coach-реплика → один пуш родителю нитки, findByID группы не нужен', async () => {
    const { req, findByID } = makeReq([10, 20])
    await run({ doc: { id: 1, authorRole: 'coach', parent: 5, group: 77 }, operation: 'create', req })

    expect(findByID).not.toHaveBeenCalled()
    expect(sendPushToUser).toHaveBeenCalledOnce()
    const [, userId, message] = vi.mocked(sendPushToUser).mock.calls[0]
    expect(userId).toBe(5)
    expect(message).toEqual(buildQuestionReplyMessage())
  })

  it('parent-реплика → пуш каждому тренеру группы (overrideAccess, G90)', async () => {
    const { req, findByID } = makeReq([10, 20])
    await run({ doc: { id: 1, authorRole: 'parent', parent: 5, group: 77 }, operation: 'create', req })

    expect(findByID).toHaveBeenCalledOnce()
    expect((findByID.mock.calls[0][0] as AnyArgs).overrideAccess).toBe(true)
    expect(sendPushToUser).toHaveBeenCalledTimes(2)
    const pushedTo = vi.mocked(sendPushToUser).mock.calls.map((c) => c[1]).sort()
    expect(pushedTo).toEqual([10, 20])
    expect(vi.mocked(sendPushToUser).mock.calls[0][2]).toEqual(buildQuestionMessage())
  })

  it('operation=update → пуша нет', async () => {
    const { req } = makeReq([10])
    await run({ doc: { id: 1, authorRole: 'coach', parent: 5, group: 77 }, operation: 'update', req })
    expect(sendPushToUser).not.toHaveBeenCalled()
  })

  it('ошибка пуша не валит создание реплики', async () => {
    vi.mocked(sendPushToUser).mockRejectedValueOnce(new Error('push down'))
    const { req } = makeReq([])
    await expect(
      run({ doc: { id: 1, authorRole: 'coach', parent: 5, group: 77 }, operation: 'create', req }),
    ).resolves.toBeDefined()
  })
})
