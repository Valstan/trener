import { describe, expect, it } from 'vitest'

import { timingSafeEqualStr } from './timingSafeEqualStr'

// Аудит #057 (вектор a): сравнение CRON_SECRET шло обычным `!==` в крон-роутах.
describe('timingSafeEqualStr', () => {
  it('совпадающие строки равны', () => {
    expect(timingSafeEqualStr('secret-value', 'secret-value')).toBe(true)
  })

  it('различающиеся строки не равны', () => {
    expect(timingSafeEqualStr('secret-value', 'secret-valuE')).toBe(false)
  })

  it('разная длина — false, а не исключение', () => {
    expect(timingSafeEqualStr('short', 'much-longer-secret')).toBe(false)
    expect(timingSafeEqualStr('', 'x')).toBe(false)
    expect(timingSafeEqualStr('', '')).toBe(true)
  })

  it('кириллица и длинные значения', () => {
    expect(timingSafeEqualStr('секрет-длинный-значение', 'секрет-длинный-значение')).toBe(true)
    expect(timingSafeEqualStr('секрет-длинный-значение', 'секрет-длинный-значени')).toBe(false)
  })
})
