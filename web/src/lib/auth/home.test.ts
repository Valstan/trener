import { describe, it, expect } from 'vitest'

import { homePathForUser } from './home'

describe('homePathForUser', () => {
  it('admin → админка координатора', () => {
    expect(homePathForUser({ roles: ['admin'] })).toBe('/admin')
  })

  it('coach → расписание со сводкой coverage', () => {
    expect(homePathForUser({ roles: ['coach'] })).toBe('/coach/schedule')
  })

  it('parent → очередь изменений', () => {
    expect(homePathForUser({ roles: ['parent'] })).toBe('/parent')
  })

  it('admin важнее coach/parent (приоритет ролей)', () => {
    expect(homePathForUser({ roles: ['parent', 'coach', 'admin'] })).toBe('/admin')
    expect(homePathForUser({ roles: ['parent', 'coach'] })).toBe('/coach/schedule')
  })

  it('гость / пустая роль → лендинг (без петли редиректа)', () => {
    expect(homePathForUser(null)).toBe('/')
    expect(homePathForUser(undefined)).toBe('/')
    expect(homePathForUser({ roles: [] })).toBe('/')
    expect(homePathForUser({ roles: null })).toBe('/')
  })
})
