import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { PayloadRequest } from 'payload'

import { sendPushToUser } from '../lib/push/send'
import { fanOutChatMessage } from './fanOutChatMessage'

// fanOutChatMessage — пуш остальным участникам комнаты (mock req.payload + mock
// sendPushToUser). Фиксируем:
//  • пуш ТОЛЬКО на create;
//  • адресаты зависят от СКОУПА и КОМНАТЫ (группа / филиал / школа; взрослая /
//    детская) — до 09.08 branch/school были беззвучны, а детская комната пушила
//    родителям вместо детей;
//  • дубли схлопываются, автор исключается;
//  • Notifications НЕ создаются (вне coverage);
//  • G90: служебные find — overrideAccess;
//  • падение пуша одному не рвёт рассылку остальным (R5).

vi.mock('../lib/push/send', () => ({ sendPushToUser: vi.fn(async () => 'ok') }))

type AnyArgs = Record<string, unknown>

type World = {
  groups?: { id: number; coaches?: number[]; branch?: number }[]
  players?: { id: number; parent?: number | null; account?: number | null; group?: number }[]
  users?: { id: number }[]
}

const makeReq = (world: World) => {
  const create = vi.fn(async (_args: AnyArgs) => ({ id: 1 }))
  const logger = { info: vi.fn(), error: vi.fn() }
  const find = vi.fn(async ({ collection }: AnyArgs) => {
    if (collection === 'groups') return { docs: world.groups ?? [] }
    if (collection === 'players') return { docs: world.players ?? [] }
    if (collection === 'users') return { docs: world.users ?? [] }
    return { docs: [] }
  })
  const findByID = vi.fn(async ({ id }: AnyArgs) => (world.groups ?? []).find((g) => g.id === id) ?? null)
  const req = { payload: { find, findByID, create, logger } } as unknown as PayloadRequest
  return { req, find, findByID, create, logger }
}

const run = (args: { doc: AnyArgs; operation: 'create' | 'update'; req: PayloadRequest }) =>
  fanOutChatMessage(args as never)

const pushedTo = () =>
  vi.mocked(sendPushToUser).mock.calls.map((c) => Number(c[1])).sort((a, b) => a - b)

beforeEach(() => {
  vi.mocked(sendPushToUser).mockReset()
  vi.mocked(sendPushToUser).mockImplementation(async () => 'ok' as never)
})

describe('fanOutChatMessage — групповая взрослая комната', () => {
  it('create → пуш тренерам и родителям группы, кроме автора', async () => {
    const { req, find, create } = makeReq({
      groups: [{ id: 77, coaches: [10, 20] }],
      players: [
        { id: 1, parent: 30 },
        { id: 2, parent: 40 },
      ],
    })
    await run({ doc: { id: 5, scope: 'group', room: 'adults', group: 77, author: 30 }, operation: 'create', req })

    for (const call of find.mock.calls) expect((call[0] as AnyArgs).overrideAccess).toBe(true) // G90
    expect(pushedTo()).toEqual([10, 20, 40]) // автор 30 исключён
    expect(create).not.toHaveBeenCalled() // вне coverage
  })

  it('родитель двоих детей получает один пуш', async () => {
    const { req } = makeReq({ groups: [{ id: 77, coaches: [] }], players: [{ id: 1, parent: 55 }, { id: 2, parent: 55 }] })
    await run({ doc: { id: 5, scope: 'group', room: 'adults', group: 77, author: 10 }, operation: 'create', req })
    expect(pushedTo()).toEqual([55])
  })

  it('operation=update → пуш не повторяется', async () => {
    const { req, find } = makeReq({ groups: [{ id: 77, coaches: [10] }] })
    await run({ doc: { id: 5, scope: 'group', room: 'adults', group: 77, author: 1 }, operation: 'update', req })
    expect(find).not.toHaveBeenCalled()
    expect(sendPushToUser).not.toHaveBeenCalled()
  })

  it('падение пуша одному не рвёт рассылку остальным', async () => {
    const { req, logger } = makeReq({ groups: [{ id: 77, coaches: [10, 20] }], players: [] })
    vi.mocked(sendPushToUser).mockImplementationOnce(async () => {
      throw new Error('подписка протухла')
    })
    await run({ doc: { id: 5, scope: 'group', room: 'adults', group: 77, author: 99 }, operation: 'create', req })
    expect(sendPushToUser).toHaveBeenCalledTimes(2)
    expect(logger.error).toHaveBeenCalled()
  })

  it('нет адресатов — тихо выходит', async () => {
    const { req } = makeReq({ groups: [{ id: 77, coaches: [] }], players: [] })
    await expect(
      run({ doc: { id: 5, scope: 'group', room: 'adults', group: 77, author: 1 }, operation: 'create', req }),
    ).resolves.toBeTruthy()
    expect(sendPushToUser).not.toHaveBeenCalled()
  })
})

describe('fanOutChatMessage — детская комната', () => {
  it('пуш идёт АККАУНТАМ ДЕТЕЙ и тренерам, родителям — нет', async () => {
    const { req } = makeReq({
      groups: [{ id: 77, coaches: [10] }],
      players: [
        { id: 1, parent: 30, account: 101 },
        { id: 2, parent: 40, account: 102 },
        { id: 3, parent: 50, account: null }, // без аккаунта — пропуск
      ],
    })
    await run({ doc: { id: 5, scope: 'group', room: 'children', group: 77, author: 101 }, operation: 'create', req })
    expect(pushedTo()).toEqual([10, 102]) // автор-ребёнок 101 исключён, родители 30/40/50 не получают
  })
})

describe('fanOutChatMessage — филиал и вся школа (раньше были беззвучны)', () => {
  it('branch: персонал филиала + родители детей его групп', async () => {
    const { req } = makeReq({
      groups: [{ id: 1, coaches: [11], branch: 9 }, { id: 2, coaches: [12], branch: 9 }],
      players: [{ id: 1, parent: 31, group: 1 }, { id: 2, parent: 32, group: 2 }],
      users: [{ id: 21 }], // админ филиала
    })
    await run({ doc: { id: 5, scope: 'branch', room: 'adults', branch: 9, group: null, author: 31 }, operation: 'create', req })
    expect(pushedTo()).toEqual([11, 12, 21, 32])
  })

  it('school: все подтверждённые взрослые сети', async () => {
    const { req } = makeReq({ users: [{ id: 1 }, { id: 2 }, { id: 3 }] })
    await run({ doc: { id: 5, scope: 'school', room: 'adults', group: null, branch: null, author: 2 }, operation: 'create', req })
    expect(pushedTo()).toEqual([1, 3])
  })

  it('branch без филиала в теме — не падает, адресатов нет', async () => {
    const { req } = makeReq({})
    await run({ doc: { id: 5, scope: 'branch', room: 'adults', group: null, branch: null, author: 1 }, operation: 'create', req })
    expect(sendPushToUser).not.toHaveBeenCalled()
  })
})
