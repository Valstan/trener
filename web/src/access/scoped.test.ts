import { describe, it, expect } from 'vitest'

import { selfByField, selfByParent, selfByUser } from './scoped'

// Скоупинг «только свои» по relationship-полю (#015). Критик M2 (M7) отдельно
// предупредил: это НЕ adminOrSelf — тот фильтрует по `id` САМОЙ записи (для users),
// а здесь фильтр по значению поля-ссылки. Тест фиксирует это различие, чтобы
// случайная замена на adminOrSelf (которая бы открыла чужие записи) падала.

const call = (access: ReturnType<typeof selfByField>, user: unknown) =>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (access as any)({ req: { user } })

describe('selfByField', () => {
  it('false для анонима', () => {
    expect(call(selfByField('parent'), null)).toBe(false)
    expect(call(selfByField('parent'), undefined)).toBe(false)
  })

  it('true для админа (видит все)', () => {
    expect(call(selfByField('parent'), { id: 7, roles: ['admin'] })).toBe(true)
  })

  it('Where по указанному полю для не-админа', () => {
    expect(call(selfByField('parent'), { id: 42, roles: ['parent'] })).toEqual({
      parent: { equals: 42 },
    })
  })

  it('фильтрует по значению поля-ссылки, НЕ по id записи (отличие от adminOrSelf)', () => {
    const where = call(selfByField('user'), { id: 5, roles: ['parent'] })
    expect(where).toEqual({ user: { equals: 5 } })
    expect(where).not.toHaveProperty('id')
  })
})

describe('selfByUser / selfByParent', () => {
  it('selfByUser скоупит по полю user', () => {
    expect(call(selfByUser, { id: 3, roles: ['parent'] })).toEqual({ user: { equals: 3 } })
  })

  it('selfByParent скоупит по полю parent', () => {
    expect(call(selfByParent, { id: 9, roles: ['coach'] })).toEqual({ parent: { equals: 9 } })
  })

  it('админ — true в обоих', () => {
    expect(call(selfByUser, { id: 1, roles: ['admin'] })).toBe(true)
    expect(call(selfByParent, { id: 1, roles: ['admin'] })).toBe(true)
  })
})
