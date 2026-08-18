import type { Payload } from 'payload'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

import { sendPushToUser } from './send'
import { buildAnnouncementMessage } from './message'

// sendPushToUser — демо-юзер: инцидент D-029/#133, если реальному телефону чужого
// человека прилетит пуш из витринного тура. Belt+suspenders: подписки демо-юзеру и
// так не создаются (push/subscribe 403), но проверяем это и здесь — на случай
// устаревших/ручных записей Devices.
describe('sendPushToUser — демо-глушитель', () => {
  const OLD_ENV = process.env

  beforeEach(() => {
    process.env = { ...OLD_ENV, NEXT_PUBLIC_VAPID_PUBLIC_KEY: 'pub', VAPID_PRIVATE_KEY: 'priv' }
  })

  afterEach(() => {
    process.env = OLD_ENV
  })

  it('user.demo=true → skipped, devices даже не запрашиваются', async () => {
    const find = vi.fn()
    const payload = {
      findByID: vi.fn().mockResolvedValue({ id: 1, demo: true }),
      find,
    } as unknown as Payload

    const result = await sendPushToUser(payload, 1, buildAnnouncementMessage())

    expect(result).toBe('skipped')
    expect(find).not.toHaveBeenCalled()
  })

  it('user.demo=false → идёт дальше искать devices (нет устройств → skipped)', async () => {
    const find = vi.fn().mockResolvedValue({ docs: [] })
    const payload = {
      findByID: vi.fn().mockResolvedValue({ id: 2, demo: false }),
      find,
    } as unknown as Payload

    const result = await sendPushToUser(payload, 2, buildAnnouncementMessage())

    expect(result).toBe('skipped')
    expect(find).toHaveBeenCalledTimes(1)
  })
})
