import { describe, expect, it } from 'vitest'

import { canCreateTopic } from './chatTopicScope'

// Регрессия на дыру `allowed.school ||`: тренер с правом на общешкольные темы мог
// завести тему в ЛЮБОЙ группе школы — school-флаг съедал проверку группы.
describe('canCreateTopic', () => {
  const coach = { owner: false, school: true, groups: [1, 2], branches: [5] }
  const admin = { owner: false, school: false, groups: [10, 11], branches: [7] }
  const parent = { owner: false, school: false, groups: [], branches: [] }
  const owner = { owner: true, school: true, groups: [], branches: [] }

  it('владелец — любые цели', () => {
    expect(canCreateTopic(owner, { scope: 'group', groupId: 999, branchId: null })).toBe(true)
    expect(canCreateTopic(owner, { scope: 'branch', groupId: null, branchId: 999 })).toBe(true)
    expect(canCreateTopic(owner, { scope: 'school', groupId: null, branchId: null })).toBe(true)
  })

  it('тренер: своя группа — да, чужая — НЕТ (school-флаг не помогает)', () => {
    expect(canCreateTopic(coach, { scope: 'group', groupId: 1, branchId: null })).toBe(true)
    expect(canCreateTopic(coach, { scope: 'group', groupId: 3, branchId: null })).toBe(false)
  })

  it('тренер: общешкольная тема — да (по матрице ролей)', () => {
    expect(canCreateTopic(coach, { scope: 'school', groupId: null, branchId: null })).toBe(true)
  })

  it('тренер: филиал своих групп — да, чужой — нет', () => {
    expect(canCreateTopic(coach, { scope: 'branch', groupId: null, branchId: 5 })).toBe(true)
    expect(canCreateTopic(coach, { scope: 'branch', groupId: null, branchId: 6 })).toBe(false)
  })

  it('админ филиала: свои группы/филиал — да, school — нет', () => {
    expect(canCreateTopic(admin, { scope: 'group', groupId: 10, branchId: null })).toBe(true)
    expect(canCreateTopic(admin, { scope: 'branch', groupId: null, branchId: 7 })).toBe(true)
    expect(canCreateTopic(admin, { scope: 'school', groupId: null, branchId: null })).toBe(false)
  })

  it('родитель — никуда (создание тем не для него)', () => {
    expect(canCreateTopic(parent, { scope: 'group', groupId: 1, branchId: null })).toBe(false)
    expect(canCreateTopic(parent, { scope: 'school', groupId: null, branchId: null })).toBe(false)
  })

  it('строковые и числовые id сравниваются без сюрпризов', () => {
    const t = { owner: false, school: false, groups: ['4'], branches: [] }
    expect(canCreateTopic(t, { scope: 'group', groupId: 4, branchId: null })).toBe(true)
  })

  it('нет id цели — отказ', () => {
    expect(canCreateTopic(coach, { scope: 'group', groupId: null, branchId: null })).toBe(false)
    expect(canCreateTopic(coach, { scope: 'branch', groupId: null, branchId: null })).toBe(false)
  })
})
