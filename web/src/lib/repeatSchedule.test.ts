import { describe, expect, it } from 'vitest'

import { MAX_OCCURRENCES, expandWeekly } from './repeatSchedule'

// Даты в тестах — локальные (new Date('...T18:00') без Z): функция и работает в
// локальной зоне, в этом весь её смысл.
const d = (s: string): Date => new Date(s)

describe('expandWeekly', () => {
  // 2026-08-03 — понедельник.
  const start = d('2026-08-03T18:00')
  const end = d('2026-08-03T19:30')

  it('без дней недели — ровно одно занятие', () => {
    const r = expandWeekly({ start, end, weekdays: [], until: d('2026-09-30') })
    expect(r).toHaveLength(1)
    expect(r[0]!.startDate).toBe(start.toISOString())
    expect(r[0]!.endDate).toBe(end.toISOString())
  })

  it('раскладывает по отмеченным дням недели до даты включительно', () => {
    // пн и ср, две недели: 3, 5, 10, 12 августа.
    const r = expandWeekly({ start, end, weekdays: [1, 3], until: d('2026-08-12') })
    expect(r.map((o) => new Date(o.startDate).getDate())).toEqual([3, 5, 10, 12])
  })

  it('держит время суток и длительность первого занятия', () => {
    const r = expandWeekly({ start, end, weekdays: [1, 3], until: d('2026-08-05') })
    const second = new Date(r[1]!.startDate)
    expect(second.getHours()).toBe(18)
    expect(second.getMinutes()).toBe(0)
    expect(new Date(r[1]!.endDate!).getTime() - second.getTime()).toBe(90 * 60 * 1000)
  })

  it('без endDate повторы тоже без окончания', () => {
    const r = expandWeekly({ start, weekdays: [1], until: d('2026-08-10') })
    expect(r).toHaveLength(2)
    expect(r[0]!.endDate).toBeUndefined()
    expect(r[1]!.endDate).toBeUndefined()
  })

  it('день недели решает всё: выбран понедельник, отмечены вт и чт — понедельника нет', () => {
    const r = expandWeekly({ start, end, weekdays: [2, 4], until: d('2026-08-07') })
    expect(r.map((o) => new Date(o.startDate).getDate())).toEqual([4, 6])
  })

  it('занятие последнего дня попадает в список (граница — конец дня)', () => {
    const r = expandWeekly({ start, end, weekdays: [1], until: d('2026-08-10') })
    expect(r.map((o) => new Date(o.startDate).getDate())).toEqual([3, 10])
  })

  it('«по» раньше начала — пустой список', () => {
    expect(expandWeekly({ start, end, weekdays: [1], until: d('2026-07-20') })).toEqual([])
  })

  it('обрезает по предохранителю MAX_OCCURRENCES', () => {
    const r = expandWeekly({ start, end, weekdays: [0, 1, 2, 3, 4, 5, 6], until: d('2030-01-01') })
    expect(r).toHaveLength(MAX_OCCURRENCES)
  })

  it('мусорные дни недели игнорирует, кривые даты дают пусто', () => {
    const r = expandWeekly({ start, end, weekdays: [1, 9, -2, 1.5], until: d('2026-08-10') })
    expect(r.map((o) => new Date(o.startDate).getDate())).toEqual([3, 10])
    expect(expandWeekly({ start: d('мусор'), weekdays: [1], until: d('2026-08-10') })).toEqual([])
    expect(expandWeekly({ start, weekdays: [1], until: d('мусор') })).toEqual([])
  })
})
