import type { Payload } from 'payload'
import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest'

import { sendPushToUser } from './send'
import { buildAnnouncementMessage } from './message'

// Аудит #057, вектор (f), high: после отзыва согласия родитель продолжал получать
// пуши о тренировках ребёнка — фильтровался только демо-адресат.
//
// Почему это ПОВЕДЕНЧЕСКИЙ тест, а не чтение исходников send.ts: гейт, который ищет
// в файле упоминание `pushAllowedByConsent`, обманывается трижды — на импорте (строка
// всегда выше выборки устройств), на `if (false && проверка)` и на выносе проверки в
// мёртвую ветку. Именно такой гейт и стоял первой версией: он был зелёным на файле с
// выключенной проверкой. Поведение («доставки нет, устройства даже не запрашивались»)
// отсекает все три.
const sendNotification = vi.fn().mockResolvedValue({ statusCode: 201 })

vi.mock('web-push', () => ({
  default: {
    setVapidDetails: vi.fn(),
    sendNotification: (...args: unknown[]) => sendNotification(...args),
  },
}))

const OLD_ENV = process.env

const parentUser = (id: number) => ({ id, demo: false, roles: ['parent'] }) as unknown as
  Parameters<Payload['findByID']>[0] extends never ? never : Record<string, unknown>

type PayloadMock = {
  payload: Payload
  count: ReturnType<typeof vi.fn>
  find: ReturnType<typeof vi.fn>
  update: ReturnType<typeof vi.fn>
}

const mockPayload = (opts: {
  user: Record<string, unknown> | null
  consents: number
  devices?: unknown[]
}): PayloadMock => {
  const count = vi.fn().mockResolvedValue({ totalDocs: opts.consents })
  const find = vi.fn().mockResolvedValue({ docs: opts.devices ?? [] })
  const update = vi.fn().mockResolvedValue({})
  const payload = {
    findByID: vi.fn().mockResolvedValue(opts.user),
    count,
    find,
    update,
    delete: vi.fn().mockResolvedValue({ docs: [] }),
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  } as unknown as Payload
  return { payload, count, find, update }
}

const device = { id: 10, endpoint: 'https://push.example/abc', p256dh: 'p', auth: 'a', failureCount: 0 }

beforeEach(() => {
  process.env = { ...OLD_ENV, NEXT_PUBLIC_VAPID_PUBLIC_KEY: 'pub', VAPID_PRIVATE_KEY: 'priv' }
  sendNotification.mockClear()
  sendNotification.mockResolvedValue({ statusCode: 201 })
})

afterAll(() => {
  process.env = OLD_ENV
})

describe('пуш родителю без активного согласия не доставляется', () => {
  it('отозвавшее согласие: доставки нет, устройства даже не запрашивались', async () => {
    const { payload, count, find } = mockPayload({ user: parentUser(1), consents: 0, devices: [device] })

    const result = await sendPushToUser(payload, 1, buildAnnouncementMessage())

    expect(result).toBe('skipped')
    expect(count).toHaveBeenCalledTimes(1)
    // Устройства не читаем и тем более не шлём: согласие — до обработки, а не после.
    expect(find).not.toHaveBeenCalled()
    expect(sendNotification).not.toHaveBeenCalled()
  })

  it('никогда не дававший согласия — тот же исход (0 это и отзыв, и отсутствие)', async () => {
    const { payload, find } = mockPayload({ user: parentUser(2), consents: 0, devices: [device] })

    expect(await sendPushToUser(payload, 2, buildAnnouncementMessage())).toBe('skipped')
    expect(find).not.toHaveBeenCalled()
    expect(sendNotification).not.toHaveBeenCalled()
  })

  it('родитель с согласием — доставка идёт (иначе фильтр тихо ломает работу)', async () => {
    const { payload, count, find } = mockPayload({ user: parentUser(3), consents: 1, devices: [device] })

    const result = await sendPushToUser(payload, 3, buildAnnouncementMessage())

    expect(result).toBe('ok')
    expect(count).toHaveBeenCalledTimes(1)
    expect(find).toHaveBeenCalledTimes(1)
    expect(sendNotification).toHaveBeenCalledTimes(1)
  })

  it('согласие считается по конкретному адресату, один раз за вызов', async () => {
    const { payload, count } = mockPayload({ user: parentUser(4), consents: 1, devices: [device] })

    await sendPushToUser(payload, 4, buildAnnouncementMessage())

    expect(count).toHaveBeenCalledTimes(1)
    const arg = count.mock.calls[0][0] as { where: { and: unknown[] } }
    expect(JSON.stringify(arg.where)).toContain('"equals":4')
  })

  it('не-родителю согласие не спрашивается вовсе (тренер/админ/владелец)', async () => {
    const { payload, count, find } = mockPayload({
      user: { id: 5, demo: false, roles: ['coach'] } as unknown as Record<string, unknown>,
      consents: 0,
      devices: [device],
    })

    expect(await sendPushToUser(payload, 5, buildAnnouncementMessage())).toBe('ok')
    expect(count).not.toHaveBeenCalled()
    expect(sendNotification).toHaveBeenCalledTimes(1)
  })

  it('демо-адресат отсекается ДО вопроса о согласии (две проверки не смешиваем)', async () => {
    const { payload, count } = mockPayload({
      user: { id: 6, demo: true, roles: ['parent'] } as unknown as Record<string, unknown>,
      consents: 1,
    })

    expect(await sendPushToUser(payload, 6, buildAnnouncementMessage())).toBe('skipped')
    expect(count).not.toHaveBeenCalled()
  })
})