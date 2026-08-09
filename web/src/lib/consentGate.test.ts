import { describe, expect, it } from 'vitest'

import { needsConsent } from './consentGate'

// Гейт согласия: родитель + филиал + дети + нет записи согласия → на экран согласия.
describe('needsConsent', () => {
  const base = { parent: true, branchId: 1 as number | null, playersCount: 2, consentsCount: 0 }

  it('родитель с детьми, филиалом и без согласия → гейтим', () => {
    expect(needsConsent(base)).toBe(true)
  })

  it('согласие уже записано → пропускаем', () => {
    expect(needsConsent({ ...base, consentsCount: 1 })).toBe(false)
  })

  it('нет детей → нечего гейтить', () => {
    expect(needsConsent({ ...base, playersCount: 0 })).toBe(false)
  })

  it('нет филиала (легаси-родитель) → НЕ гейтим: экран согласия без филиала уходит редиректом, был бы цикл', () => {
    expect(needsConsent({ ...base, branchId: null })).toBe(false)
  })

  it('не родитель → мимо', () => {
    expect(needsConsent({ ...base, parent: false })).toBe(false)
  })
})
