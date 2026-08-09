import { describe, expect, it } from 'vitest'

import { collectedInMonth, debtSummary, monthOf, sumAmounts } from './paymentTotals'

describe('monthOf', () => {
  it('ISO → YYYY-MM; пусто/битое → null', () => {
    expect(monthOf('2026-08-09T12:00:00.000Z')).toBe('2026-08')
    expect(monthOf(null)).toBeNull()
    expect(monthOf('не дата')).toBeNull()
  })
})

describe('collectedInMonth', () => {
  const subs = [
    { amount: 2500, createdAt: '2026-08-01T10:00:00Z' },
    { amount: 3000, createdAt: '2026-08-20T10:00:00Z' },
    { amount: 2500, createdAt: '2026-07-31T10:00:00Z' }, // другой месяц
    { amount: null, createdAt: '2026-08-05T10:00:00Z' }, // без суммы — в count, не в total
  ]
  it('суммирует только записи месяца', () => {
    expect(collectedInMonth(subs, '2026-08')).toEqual({ count: 3, total: 5500 })
    expect(collectedInMonth(subs, '2026-07')).toEqual({ count: 1, total: 2500 })
    expect(collectedInMonth(subs, '2026-06')).toEqual({ count: 0, total: 0 })
  })
})

describe('sumAmounts', () => {
  it('складывает, null-суммы как 0', () => {
    expect(sumAmounts([{ amount: 2500 }, { amount: null }, { amount: 500 }])).toBe(3000)
    expect(sumAmounts([])).toBe(0)
  })
})

describe('debtSummary', () => {
  it('должники = expired|none; цена не задана → в count, не в total', () => {
    const rows = [
      { status: 'expired' as const, fee: 2500 },
      { status: 'none' as const, fee: null },
      { status: 'active' as const, fee: 2500 },
      { status: 'expiring' as const, fee: 2500 },
    ]
    expect(debtSummary(rows)).toEqual({ count: 2, total: 2500 })
  })
})
