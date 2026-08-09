import { describe, expect, it } from 'vitest'

import { amountValid, MAX_PAYMENT_AMOUNT, paidRangeValid } from './paymentInput'

describe('paidRangeValid', () => {
  it('from <= until — валидно; from > until — нет', () => {
    expect(paidRangeValid('2026-08-01', '2026-08-31')).toBe(true)
    expect(paidRangeValid('2026-08-31', '2026-08-01')).toBe(false)
    expect(paidRangeValid('2026-08-01', '2026-08-01')).toBe(true)
  })
  it('пустой from валиден; битые даты — нет', () => {
    expect(paidRangeValid(null, '2026-08-31')).toBe(true)
    expect(paidRangeValid(undefined, '2026-08-31')).toBe(true)
    expect(paidRangeValid('не дата', '2026-08-31')).toBe(false)
    expect(paidRangeValid('2026-08-01', 'не дата')).toBe(false)
  })
})

describe('amountValid', () => {
  it('границы: 0 валиден (ловушка ||), потолок ловит опечатку в ноль', () => {
    expect(amountValid(0)).toBe(true)
    expect(amountValid(2500)).toBe(true)
    expect(amountValid(MAX_PAYMENT_AMOUNT)).toBe(true)
    expect(amountValid(MAX_PAYMENT_AMOUNT + 1)).toBe(false)
    expect(amountValid(-1)).toBe(false)
    expect(amountValid(null)).toBe(true)
  })
})
