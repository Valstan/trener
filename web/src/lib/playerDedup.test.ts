import { describe, expect, it } from 'vitest'

import { dedupFill, findDuplicateChild, sameChildName, type ExistingChild } from './playerDedup'

// Бэклог-п.11: подтверждение заявки не должно создавать второго ребёнка, если тот
// же ребёнок уже заведён импортом (или привязан по ссылке-приглашению).

const child = (over: Partial<ExistingChild> = {}): ExistingChild => ({
  id: 1,
  name: 'Иван Петров',
  dateOfBirth: null,
  accountId: null,
  branchId: null,
  ...over,
})

describe('findDuplicateChild: кого считаем тем же ребёнком', () => {
  it('то же имя без даты рождения — тот же ребёнок (импорт ДР не ставит)', () => {
    expect(findDuplicateChild([child()], { name: 'Иван Петров' })).toMatchObject({ id: 1 })
  })

  it('регистр и лишние пробелы не создают второго ребёнка', () => {
    const found = findDuplicateChild([child({ name: '  иван   ПЕТРОВ ' })], { name: 'Иван Петров' })
    expect(found).toMatchObject({ id: 1 })
    expect(sameChildName('Иван  Петров', ' иван петров')).toBe(true)
  })

  it('разные имена — разные дети', () => {
    expect(findDuplicateChild([child({ name: 'Иван Петров' })], { name: 'Пётр Петров' })).toBeNull()
  })

  it('оба дня рождения известны и различаются — это разные дети, не склейка', () => {
    const found = findDuplicateChild(
      [child({ dateOfBirth: '2015-04-01' })],
      { name: 'Иван Петров', dateOfBirth: '2016-09-14' },
    )
    expect(found).toBeNull()
  })

  it('совпадающий день рождения не мешает склейке', () => {
    const found = findDuplicateChild(
      [child({ dateOfBirth: '2015-04-01T00:00:00.000Z' })],
      { name: 'Иван Петров', dateOfBirth: '2015-04-01' },
    )
    expect(found).toMatchObject({ id: 1 })
  })

  it('совпадение account сильнее имени', () => {
    const found = findDuplicateChild(
      [child({ name: 'Иван П.', accountId: 42 })],
      { name: 'Иван Петров', accountId: 42 },
    )
    expect(found).toMatchObject({ id: 1, accountId: 42 })
  })

  it('пустой список — создавать нового', () => {
    expect(findDuplicateChild([], { name: 'Иван Петров' })).toBeNull()
  })

  it('ребёнок с пустым именем не склеивается с любым именем', () => {
    expect(findDuplicateChild([child({ name: '' })], { name: 'Иван Петров' })).toBeNull()
  })
})

describe('dedupFill: что дописать существующему ряду', () => {
  it('привязывает аккаунт, если он свободен', () => {
    expect(dedupFill(child(), { name: 'Иван Петров', accountId: 7 }, false)).toEqual({ account: 7 })
  })

  it('не перевешивает аккаунт, который уже держит другой ряд', () => {
    expect(dedupFill(child(), { name: 'Иван Петров', accountId: 7 }, true)).toEqual({})
  })

  it('не перетирает уже заполненные дату рождения и филиал', () => {
    const target = child({ dateOfBirth: '2015-04-01', branchId: 3, accountId: 9 })
    const fill = dedupFill(target, { name: 'Иван Петров', dateOfBirth: '2016-01-01', branchId: 5, accountId: 9 }, false)
    expect(fill).toEqual({})
  })

  it('дополняет пустые дату рождения и филиал', () => {
    const fill = dedupFill(child(), { name: 'Иван Петров', dateOfBirth: '2016-01-01', branchId: 5 }, false)
    expect(fill).toEqual({ dateOfBirth: '2016-01-01', branch: 5 })
  })

  it('группу не трогает никогда — у импортированного ребёнка она настоящая', () => {
    const fill = dedupFill(child({ branchId: 1 }), { name: 'Иван Петров', branchId: 1 }, false)
    expect(Object.keys(fill)).not.toContain('group')
  })
})
