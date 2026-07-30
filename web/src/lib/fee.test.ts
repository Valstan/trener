import { describe, expect, it } from 'vitest'

import { feeForGroup, formatFee } from './fee'

describe('feeForGroup', () => {
  it('цена группы важнее цены филиала', () => {
    expect(feeForGroup(3000, 2500)).toBe(3000)
  })

  it('пустая цена группы наследует филиал', () => {
    expect(feeForGroup(null, 2500)).toBe(2500)
    expect(feeForGroup(undefined, 2500)).toBe(2500)
  })

  it('ноль — валидная цена, а не «не задано»', () => {
    // Ловушка `groupFee || branchFee`: бесплатная группа стала бы платной.
    expect(feeForGroup(0, 2500)).toBe(0)
    expect(feeForGroup(null, 0)).toBe(0)
  })

  it('нигде не задано — null (экран не показывает «к оплате»)', () => {
    expect(feeForGroup(null, null)).toBeNull()
    expect(feeForGroup(undefined, undefined)).toBeNull()
  })

  it('мусор игнорирует', () => {
    expect(feeForGroup(Number.NaN, 2500)).toBe(2500)
    expect(feeForGroup(Number.POSITIVE_INFINITY, null)).toBeNull()
  })
})

describe('formatFee', () => {
  it('разряды и знак рубля', () => {
    // Пробел-разделитель у Intl неразрывный и зависит от версии ICU — сверяем
    // цифры и знак, а не конкретный пробел.
    expect(formatFee(2500).replace(/\s/g, ' ')).toBe('2 500 ₽')
    expect(formatFee(0).replace(/\s/g, ' ')).toBe('0 ₽')
  })
})
