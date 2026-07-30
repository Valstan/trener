import { describe, expect, it } from 'vitest'

import { parseStaffInvite } from './staffInvite'

describe('parseStaffInvite', () => {
  const valid = { email: ' Coach@Trener.LOCAL ', name: '  Иван Петров ', role: 'coach' }

  it('нормализует email в нижний регистр и триммит имя', () => {
    const r = parseStaffInvite(valid)
    expect(r).toEqual({ email: 'coach@trener.local', name: 'Иван Петров', role: 'coach', branchId: null, groupIds: [] })
  })

  it('роль только coach или admin', () => {
    expect(parseStaffInvite({ ...valid, role: 'admin' })!.role).toBe('admin')
    expect(parseStaffInvite({ ...valid, role: 'owner' })).toBeNull()
    expect(parseStaffInvite({ ...valid, role: 'parent' })).toBeNull()
    expect(parseStaffInvite({ ...valid, role: 42 })).toBeNull()
  })

  it('мусорный email и пустое имя — null', () => {
    expect(parseStaffInvite({ ...valid, email: 'без-собаки' })).toBeNull()
    expect(parseStaffInvite({ ...valid, email: 'a@b' })).toBeNull()
    expect(parseStaffInvite({ ...valid, email: 'a @b.ru' })).toBeNull()
    expect(parseStaffInvite({ ...valid, name: '   ' })).toBeNull()
    expect(parseStaffInvite(null)).toBeNull()
    expect(parseStaffInvite('x')).toBeNull()
  })

  it('имя режется по длине', () => {
    expect(parseStaffInvite({ ...valid, name: 'и'.repeat(300) })!.name).toHaveLength(120)
  })

  it('группы: только целые положительные, дубли схлопываются, мусор отбрасывается', () => {
    const r = parseStaffInvite({ ...valid, groupIds: [3, 3, 1, -2, 0, 1.5, 'x', null] })
    expect(r!.groupIds).toEqual([3, 1])
  })

  it('филиал: только целый положительный, иначе null', () => {
    expect(parseStaffInvite({ ...valid, branchId: 2 })!.branchId).toBe(2)
    expect(parseStaffInvite({ ...valid, branchId: 0 })!.branchId).toBeNull()
    expect(parseStaffInvite({ ...valid, branchId: '2' })!.branchId).toBeNull()
  })
})
