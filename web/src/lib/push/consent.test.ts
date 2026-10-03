import type { Payload } from 'payload'
import { describe, expect, it, vi } from 'vitest'

import { countActiveConsents, pushAllowedByConsent } from './consent'

// Аудит #057, вектор (f): пуш после отзыва согласия. `sendPushToUser` глушила только
// демо-адресата, поэтому родитель, отозвавший согласие (или не давший его вовсе),
// продолжал получать пуши о тренировках ребёнка. Фильтр стоит в шлюзе отправки.
describe('pushAllowedByConsent — предикат', () => {
  it('родитель без активного согласия → пуз запрещён (отзыв = строки удалены)', () => {
    expect(pushAllowedByConsent({ parent: true, consentsCount: 0 })).toBe(false)
  })

  it('родитель с согласием → пуз разрешён', () => {
    expect(pushAllowedByConsent({ parent: true, consentsCount: 1 })).toBe(true)
  })

  it('не-родитель (тренер/админ/владелец) → согласие родителя не его дело', () => {
    // Отзыв согласия одним из детей не должен глушить рабочие уведомления сотрудника.
    expect(pushAllowedByConsent({ parent: false, consentsCount: 0 })).toBe(true)
  })
})

describe('countActiveConsents — что считаем', () => {
  const payloadWith = (totalDocs: number) =>
    ({
      count: vi.fn().mockResolvedValue({ totalDocs }),
    }) as unknown as Payload

  it('считает только согласия consentGiven=true конкретного родителя', async () => {
    const count = vi.fn().mockResolvedValue({ totalDocs: 2 })
    const payload = { count } as unknown as Payload

    await expect(countActiveConsents(payload, 7)).resolves.toBe(2)

    const arg = count.mock.calls[0][0] as unknown as {
      collection: string
      where: { and: unknown[] }
      overrideAccess: boolean
    }
    expect(arg.collection).toBe('consents')
    expect(JSON.stringify(arg.where)).toContain('"equals":7')
    expect(JSON.stringify(arg.where)).toContain('consentGiven')
    // Родитель не может увидеть/посчитать чужие согласия: overrideAccess тут обязателен.
    expect(arg.overrideAccess).toBe(true)
  })

  it('нулевое число = пуз запрещён', async () => {
    await expect(countActiveConsents(payloadWith(0), 7)).resolves.toBe(0)
  })
})