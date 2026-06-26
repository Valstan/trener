import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { PayloadRequest } from 'payload'

import { sendPushToUser } from '../lib/push/send'
import { fanOutAnnouncement } from './fanOutAnnouncement'

// fanOutAnnouncement — фан-аут объявления (mock req.payload + mock sendPushToUser).
// Фиксируем:
//  • пуш ТОЛЬКО на create и ТОЛЬКО при triggersPush (granularity §6);
//  • один пуш на родителя (дети одного родителя не дублируют);
//  • F1: Notifications НЕ создаются (payload.create не вызывается) — объявление вне coverage;
//  • G90: find детей — overrideAccess.

vi.mock('../lib/push/send', () => ({ sendPushToUser: vi.fn(async () => 'ok') }))

type AnyArgs = Record<string, unknown>

const makeReq = (players: { id: number; parent: number | null }[]) => {
  const find = vi.fn(async (_args: AnyArgs) => ({ docs: players }))
  const create = vi.fn(async (_args: AnyArgs) => ({ id: 1 }))
  const logger = { info: vi.fn(), error: vi.fn() }
  const req = { payload: { find, create, logger } } as unknown as PayloadRequest
  return { req, find, create }
}

const run = (args: { doc: AnyArgs; operation: 'create' | 'update'; req: PayloadRequest }) =>
  fanOutAnnouncement(args as never)

beforeEach(() => {
  vi.mocked(sendPushToUser).mockClear()
})

describe('fanOutAnnouncement', () => {
  it('create + triggersPush → один пуш на родителя, дети не дублируют, Notifications не создаются', async () => {
    const { req, find, create } = makeReq([
      { id: 1, parent: 10 },
      { id: 2, parent: 10 }, // тот же родитель → один пуш
      { id: 3, parent: 20 },
      { id: 4, parent: null }, // без родителя → пропуск
    ])

    await run({ doc: { id: 500, group: 77, triggersPush: true }, operation: 'create', req })

    // дети тянутся по группе, overrideAccess (G90)
    expect(find).toHaveBeenCalledOnce()
    expect((find.mock.calls[0][0] as AnyArgs).where).toEqual({ group: { equals: 77 } })
    expect((find.mock.calls[0][0] as AnyArgs).overrideAccess).toBe(true)

    // один пуш на КАЖДОГО уникального родителя (10, 20), не на ребёнка
    expect(sendPushToUser).toHaveBeenCalledTimes(2)
    const pushedTo = vi.mocked(sendPushToUser).mock.calls.map((c) => c[1]).sort()
    expect(pushedTo).toEqual([10, 20])

    // F1: объявление НЕ создаёт Notifications (не влияет на coverage)
    expect(create).not.toHaveBeenCalled()
  })

  it('triggersPush=false → ленты достаточно, пуша нет', async () => {
    const { req, find } = makeReq([{ id: 1, parent: 10 }])
    await run({ doc: { id: 500, group: 77, triggersPush: false }, operation: 'create', req })
    expect(find).not.toHaveBeenCalled()
    expect(sendPushToUser).not.toHaveBeenCalled()
  })

  it('operation=update (правка существующего) → пуш не повторяется', async () => {
    const { req, find } = makeReq([{ id: 1, parent: 10 }])
    await run({ doc: { id: 500, group: 77, triggersPush: true }, operation: 'update', req })
    expect(find).not.toHaveBeenCalled()
    expect(sendPushToUser).not.toHaveBeenCalled()
  })
})
