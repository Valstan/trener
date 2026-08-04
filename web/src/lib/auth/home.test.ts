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

  it('child → детский экран', () => {
    expect(homePathForUser({ roles: ['child'] })).toBe('/child')
  })

  it('admin важнее coach/parent (приоритет ролей)', () => {
    expect(homePathForUser({ roles: ['parent', 'coach', 'admin'] })).toBe('/admin')
    expect(homePathForUser({ roles: ['parent', 'coach'] })).toBe('/coach/schedule')
  })

  it('owner → админка (M5)', () => {
    expect(homePathForUser({ roles: ['owner'] })).toBe('/admin')
  })

  it('pending без выбора роли → onboarding, после выбора → ожидание', () => {
    expect(homePathForUser({ roles: ['applicant'], status: 'pending' })).toBe('/onboarding/role')
    expect(homePathForUser({ roles: ['parent'], requestedRole: 'parent', status: 'pending' })).toBe('/pending')
    expect(homePathForUser({ roles: ['coach'], requestedRole: 'coach', status: 'pending' })).toBe('/pending')
  })

  it('старый JWT без status = approved (не запираем действующих)', () => {
    expect(homePathForUser({ roles: ['parent'] })).toBe('/parent')
    expect(homePathForUser({ roles: ['parent'], status: 'approved' })).toBe('/parent')
  })

  it('гость / пустая роль → лендинг (без петли редиректа)', () => {
    expect(homePathForUser(null)).toBe('/')
    expect(homePathForUser(undefined)).toBe('/')
    expect(homePathForUser({ roles: [] })).toBe('/')
    expect(homePathForUser({ roles: null })).toBe('/')
  })
})
