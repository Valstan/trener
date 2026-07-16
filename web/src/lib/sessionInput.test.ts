import { describe, expect, it } from 'vitest'

import { parseSessionCreate, parseSessionPatch } from './sessionInput'

describe('parseSessionCreate', () => {
  const valid = { groupId: 1, startDate: '2026-07-20T10:00' }

  it('парсит минимальный валидный вход, даты нормализует в ISO', () => {
    const r = parseSessionCreate(valid)
    expect(r).not.toBeNull()
    expect(r!.groupId).toBe(1)
    expect(r!.startDate).toBe(new Date('2026-07-20T10:00').toISOString())
    expect(r!.endDate).toBeUndefined()
    expect(r!.location).toBeUndefined()
  })

  it('отклоняет мусор: не-объект, нет groupId, кривая дата', () => {
    expect(parseSessionCreate(null)).toBeNull()
    expect(parseSessionCreate('x')).toBeNull()
    expect(parseSessionCreate({ ...valid, groupId: '1' })).toBeNull()
    expect(parseSessionCreate({ ...valid, groupId: 1.5 })).toBeNull()
    expect(parseSessionCreate({ groupId: 1, startDate: 'не дата' })).toBeNull()
    expect(parseSessionCreate({ groupId: 1 })).toBeNull()
  })

  it('endDate: пустая строка = нет, кривая = 400, раньше начала = 400', () => {
    expect(parseSessionCreate({ ...valid, endDate: '' })!.endDate).toBeUndefined()
    expect(parseSessionCreate({ ...valid, endDate: 'мусор' })).toBeNull()
    expect(parseSessionCreate({ ...valid, endDate: '2026-07-20T09:00' })).toBeNull()
    expect(parseSessionCreate({ ...valid, endDate: '2026-07-20T11:30' })!.endDate).toBe(
      new Date('2026-07-20T11:30').toISOString(),
    )
  })

  it('location/note триммит и режет по maxLength', () => {
    const r = parseSessionCreate({ ...valid, location: `  Зал  `, note: 'x'.repeat(600) })
    expect(r!.location).toBe('Зал')
    expect(r!.note).toHaveLength(500)
    expect(parseSessionCreate({ ...valid, location: '   ' })!.location).toBeUndefined()
  })
})

describe('parseSessionPatch', () => {
  it('отклоняет без sessionId и с пустым патчем', () => {
    expect(parseSessionPatch({ startDate: '2026-07-20T10:00' })).toBeNull()
    expect(parseSessionPatch({ sessionId: 5 })).toBeNull()
    expect(parseSessionPatch({ sessionId: 5, cancel: false })).toBeNull()
  })

  it('частичный патч: в data только пришедшие поля (C1)', () => {
    const r = parseSessionPatch({ sessionId: 5, location: 'Стадион' })
    expect(r).toEqual({ sessionId: 5, data: { location: 'Стадион' } })
  })

  it('пустая строка/null = очистка поля (null)', () => {
    expect(parseSessionPatch({ sessionId: 5, endDate: '' })!.data.endDate).toBeNull()
    expect(parseSessionPatch({ sessionId: 5, location: '  ' })!.data.location).toBeNull()
    expect(parseSessionPatch({ sessionId: 5, note: null })!.data.note).toBeNull()
  })

  it('кривые даты и конец раньше начала — 400', () => {
    expect(parseSessionPatch({ sessionId: 5, startDate: 'мусор' })).toBeNull()
    expect(parseSessionPatch({ sessionId: 5, endDate: 'мусор' })).toBeNull()
    expect(
      parseSessionPatch({ sessionId: 5, startDate: '2026-07-20T10:00', endDate: '2026-07-20T09:00' }),
    ).toBeNull()
  })

  it('cancel:true → status cancelled', () => {
    const r = parseSessionPatch({ sessionId: 5, cancel: true })
    expect(r).toEqual({ sessionId: 5, data: { status: 'cancelled' } })
  })
})
