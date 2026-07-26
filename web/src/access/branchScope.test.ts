import { describe, it, expect } from 'vitest'

import { adminOrSelf } from './adminOrSelf'
import { adminBranchId, isOwner, rolesField } from './roles'

// M5: роли v2 (owner / филиальный admin) и не-протечка филиального скоупа.
// Ключевые инварианты: owner — god; admin БЕЗ филиала не управляет ничем
// (fail-closed); admin не может назначить owner/admin и не дотягивается до
// пользователей чужого филиала.

describe('isOwner / adminBranchId', () => {
  it('owner распознаётся, admin — нет', () => {
    expect(isOwner({ roles: ['owner'] })).toBe(true)
    expect(isOwner({ roles: ['admin'] })).toBe(false)
  })

  it('adminBranchId: id филиала как число или объект', () => {
    expect(adminBranchId({ roles: ['admin'], branch: 5 })).toBe(5)
    expect(adminBranchId({ roles: ['admin'], branch: { id: 7 } })).toBe(7)
  })

  it('fail-closed: без роли admin или без филиала — null', () => {
    expect(adminBranchId({ roles: ['admin'] })).toBe(null)
    expect(adminBranchId({ roles: ['admin'], branch: null })).toBe(null)
    expect(adminBranchId({ roles: ['coach'], branch: 5 })).toBe(null)
    expect(adminBranchId({ roles: ['owner'] })).toBe(null)
  })
})

describe('adminOrSelf (users, M5)', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const call = (user: unknown) => (adminOrSelf as any)({ req: { user } })

  it('owner — все', () => {
    expect(call({ id: 1, roles: ['owner'] })).toBe(true)
  })

  it('админ филиала — свой филиал + себя, НЕ всех', () => {
    expect(call({ id: 2, roles: ['admin'], branch: 5 })).toEqual({
      or: [{ id: { equals: 2 } }, { branch: { equals: 5 } }],
    })
  })

  it('админ без филиала — только себя (fail-closed)', () => {
    expect(call({ id: 3, roles: ['admin'] })).toEqual({ id: { equals: 3 } })
  })

  it('родитель — только себя', () => {
    expect(call({ id: 4, roles: ['parent'], branch: 5 })).toEqual({ id: { equals: 4 } })
  })
})

describe('rolesField (защита от самоповышения, M5)', () => {
  const call = (user: unknown, data?: unknown, doc?: unknown) =>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (rolesField as any)({ req: { user }, data, doc })

  it('owner назначает любые роли', () => {
    expect(call({ roles: ['owner'] }, { roles: ['owner'] })).toBe(true)
  })

  it('админ не назначает owner/admin', () => {
    const admin = { roles: ['admin'], branch: 5 }
    expect(call(admin, { roles: ['owner'], branch: 5 }, { branch: 5 })).toBe(false)
    expect(call(admin, { roles: ['admin'], branch: 5 }, { branch: 5 })).toBe(false)
  })

  it('админ назначает coach/parent в своём филиале', () => {
    const admin = { roles: ['admin'], branch: 5 }
    expect(call(admin, { roles: ['coach'] }, { branch: 5 })).toBe(true)
    expect(call(admin, { roles: ['parent'] }, { branch: { id: 5 } })).toBe(true)
  })

  it('админ не трогает роли юзера чужого филиала', () => {
    const admin = { roles: ['admin'], branch: 5 }
    expect(call(admin, { roles: ['coach'] }, { branch: 6 })).toBe(false)
    expect(call(admin, { roles: ['coach'] }, { branch: null })).toBe(false)
  })

  it('coach/parent роли менять не могут', () => {
    expect(call({ roles: ['coach'] }, { roles: ['coach'] })).toBe(false)
    expect(call({ roles: ['parent'] }, { roles: ['owner'] })).toBe(false)
  })
})
