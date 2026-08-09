import { describe, expect, it, vi, beforeEach } from 'vitest'

import { fanOutMatchChange } from './fanOutMatchChange'
import { sendPushToUser } from '../lib/push/send'
import { buildMatchMessage } from '../lib/push/message'

// Матчи до 09.08 не порождали ни одного уведомления. Фиксируем контракт:
// push-only (никаких Notification/ack), дедуп родителей, granularity-гард.
vi.mock('../lib/push/send', () => ({ sendPushToUser: vi.fn(async () => 'ok') }))

const payload = {
  find: vi.fn(async () => ({
    docs: [
      { id: 1, parent: 100 },
      { id: 2, parent: 100 }, // двое детей одного родителя → один пуш
      { id: 3, parent: 200 },
      { id: 4, parent: null }, // без родителя → пропуск
    ],
  })),
  create: vi.fn(),
  logger: { info: vi.fn(), error: vi.fn() },
}
const req = { payload } as never

const call = (doc: unknown, previousDoc: unknown, operation: 'create' | 'update') =>
  fanOutMatchChange({ doc, previousDoc, operation, req } as never)

const base = { id: 7, group: 3, matchDate: '2026-09-01T15:00:00.000Z', scoreOur: null, scoreOpponent: null }

beforeEach(() => {
  vi.mocked(sendPushToUser).mockClear()
  payload.create.mockClear()
})

describe('fanOutMatchChange', () => {
  it('создание матча → пуш родителям группы, дедуп по родителю, сироты мимо', async () => {
    await call(base, undefined, 'create')
    expect(sendPushToUser).toHaveBeenCalledTimes(2)
    const targets = vi.mocked(sendPushToUser).mock.calls.map((c) => c[1]).sort((a, b) => Number(a) - Number(b))
    expect(targets).toEqual([100, 200])
    expect(vi.mocked(sendPushToUser).mock.calls[0][2]).toEqual(buildMatchMessage('new'))
  })

  it('перенос даты → «Матч перенесён» (high)', async () => {
    await call({ ...base, matchDate: '2026-09-02T15:00:00.000Z' }, base, 'update')
    expect(vi.mocked(sendPushToUser).mock.calls[0][2]).toEqual(buildMatchMessage('moved'))
    expect(buildMatchMessage('moved').urgency).toBe('high')
  })

  it('появился счёт → «Итог матча»', async () => {
    await call({ ...base, scoreOur: 3, scoreOpponent: 1 }, base, 'update')
    expect(vi.mocked(sendPushToUser).mock.calls[0][2]).toEqual(buildMatchMessage('result'))
  })

  it('правка соперника/места — не событие (granularity-гард)', async () => {
    await call({ ...base, opponent: 'Другой' }, base, 'update')
    expect(sendPushToUser).not.toHaveBeenCalled()
  })

  it('повторное сохранение уже сыгранного матча не пушит', async () => {
    const played = { ...base, scoreOur: 3, scoreOpponent: 1 }
    await call(played, played, 'update')
    expect(sendPushToUser).not.toHaveBeenCalled()
  })

  it('НЕ создаёт Notification (ров M2 — только изменения расписания)', async () => {
    await call(base, undefined, 'create')
    expect(payload.create).not.toHaveBeenCalled()
  })

  it('падение одного пуша не рвёт рассылку', async () => {
    vi.mocked(sendPushToUser).mockRejectedValueOnce(new Error('push down'))
    await call(base, undefined, 'create')
    expect(sendPushToUser).toHaveBeenCalledTimes(2)
    expect(payload.logger.error).toHaveBeenCalled()
  })
})
