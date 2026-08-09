import { describe, expect, it } from 'vitest'

import { subscriptionStatus } from './subscriptionStatus'

// Единственная чисто-функциональная логика денежного раздела долго жила без теста.
describe('subscriptionStatus', () => {
  const now = new Date('2026-08-09T12:00:00')

  it('paidUntil сегодня — активен ВЕСЬ день включительно', () => {
    expect(subscriptionStatus('2026-08-09', now)).toBe('expiring') // сегодня = в пределах 7 дней
    expect(subscriptionStatus('2026-08-08', now)).toBe('expired')
  })

  it('порог «заканчивается» — 7 дней (конец дня paidUntil против now+7д)', () => {
    // 15.08 23:59 <= 16.08 12:00 (now+7д) → заканчивается; 16.08 23:59 > → активен.
    expect(subscriptionStatus('2026-08-15', now)).toBe('expiring')
    expect(subscriptionStatus('2026-08-16', now)).toBe('active')
  })

  it('далеко в будущем — активен; в прошлом — просрочен', () => {
    expect(subscriptionStatus('2026-12-31', now)).toBe('active')
    expect(subscriptionStatus('2026-01-01', now)).toBe('expired')
  })

  it('пусто или битая дата → none', () => {
    expect(subscriptionStatus(null, now)).toBe('none')
    expect(subscriptionStatus(undefined, now)).toBe('none')
    expect(subscriptionStatus('не дата', now)).toBe('none')
  })
})
