import { describe, it, expect } from 'vitest'

import { hasRole, isAdmin, isCoach, isParent } from './roles'

// Ролевой гейт #015 — security-critical: на нём держится write-authz и edit-gate.
// Тесты фиксируют поведение на «грязных» входах (null/undefined/не-массив roles),
// чтобы случайное ослабление (напр. трактовать отсутствие roles как доступ) падало.

describe('hasRole', () => {
  it('true, когда у пользователя есть одна из запрошенных ролей', () => {
    expect(hasRole({ roles: ['coach'] }, 'admin', 'coach')).toBe(true)
  })

  it('false, когда ни одной запрошенной роли нет', () => {
    expect(hasRole({ roles: ['parent'] }, 'admin', 'coach')).toBe(false)
  })

  it('false для null/undefined пользователя (аноним не имеет ролей)', () => {
    expect(hasRole(null, 'admin')).toBe(false)
    expect(hasRole(undefined, 'admin')).toBe(false)
  })

  it('false, когда roles отсутствует или не массив (не падать, не пропускать)', () => {
    expect(hasRole({}, 'admin')).toBe(false)
    expect(hasRole({ roles: null }, 'admin')).toBe(false)
    expect(hasRole({ roles: 'admin' as unknown as string[] }, 'admin')).toBe(false)
  })

  it('false при пустом списке запрошенных ролей', () => {
    expect(hasRole({ roles: ['admin'] })).toBe(false)
  })

  it('поддерживает несколько ролей у пользователя', () => {
    expect(hasRole({ roles: ['coach', 'parent'] }, 'parent')).toBe(true)
  })
})

describe('isAdmin / isCoach / isParent', () => {
  it('распознают свою роль', () => {
    expect(isAdmin({ roles: ['admin'] })).toBe(true)
    expect(isCoach({ roles: ['coach'] })).toBe(true)
    expect(isParent({ roles: ['parent'] })).toBe(true)
  })

  it('не путают чужую роль', () => {
    expect(isAdmin({ roles: ['coach'] })).toBe(false)
    expect(isCoach({ roles: ['parent'] })).toBe(false)
    expect(isParent({ roles: ['admin'] })).toBe(false)
  })

  it('false для анонима', () => {
    expect(isAdmin(null)).toBe(false)
    expect(isCoach(undefined)).toBe(false)
    expect(isParent(null)).toBe(false)
  })
})
