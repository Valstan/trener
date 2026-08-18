import { describe, expect, it, vi } from 'vitest'

import { allowedChatTargets, chatScopeForUser } from './chatScope'

describe('chat scopes', () => {
  it('ребёнок видит только детскую комнату своей текущей группы', async () => {
    const find = vi.fn().mockResolvedValue({ docs: [{ group: 7 }] })
    await expect(chatScopeForUser({ user: { id: 2, roles: ['child'] }, payload: { find } } as never)).resolves.toEqual({ and: [{ scope: { equals: 'group' } }, { group: { in: [7] } }, { room: { equals: 'children' } }] })
  })

  it('родитель видит взрослую комнату группы, филиал и всю школу', async () => {
    const find = vi.fn().mockResolvedValueOnce({ docs: [{ group: 7 }] }).mockResolvedValueOnce({ docs: [{ id: 7, branch: 3 }] })
    const where = await chatScopeForUser({ user: { id: 5, roles: ['parent'] }, payload: { find } } as never)
    expect(where).toEqual({ or: [{ scope: { equals: 'school' } }, { and: [{ scope: { equals: 'group' } }, { group: { in: [7] } }, { room: { equals: 'adults' } }] }, { and: [{ scope: { equals: 'branch' } }, { branch: { in: [3] } }] }] })
  })

  it('владелец видит все области', async () => {
    await expect(chatScopeForUser({ user: { id: 1, roles: ['owner'] } } as never)).resolves.toBe(true)
  })

  it('демо-owner НЕ получает school:true — падает в branch-скоуп своего демо-филиала, БЕЗ school (D-029/C1)', async () => {
    const demoOwner = { id: 1, roles: ['owner'], demo: true, branch: 7 }
    const where = await chatScopeForUser({ user: demoOwner, payload: { find: vi.fn() } } as never)
    // Живая «Вся школа» демо-анониму не видна: school-клауза не добавляется вовсе,
    // не только "school: false" — тур не должен читать чужой реальный чат.
    expect(where).toEqual({ or: [{ and: [{ scope: { equals: 'branch' } }, { branch: { in: [7] } }] }] })
  })

  it('демо-coach тоже не видит school (D-029/C1)', async () => {
    const find = vi.fn().mockResolvedValueOnce({ docs: [{ id: 9 }] }).mockResolvedValueOnce({ docs: [{ id: 9, branch: 4 }] })
    const demoCoach = { id: 2, roles: ['coach'], demo: true }
    const where = await chatScopeForUser({ user: demoCoach, payload: { find } } as never)
    expect(where).toEqual({
      or: [
        { and: [{ scope: { equals: 'group' } }, { group: { in: [9] } }] },
        { and: [{ scope: { equals: 'branch' } }, { branch: { in: [4] } }] },
      ],
    })
  })

  it('живой coach по-прежнему видит school (регрессия C1)', async () => {
    const find = vi.fn().mockResolvedValueOnce({ docs: [{ id: 9 }] }).mockResolvedValueOnce({ docs: [{ id: 9, branch: 4 }] })
    const coach = { id: 3, roles: ['coach'] }
    const where = await chatScopeForUser({ user: coach, payload: { find } } as never)
    expect(where).toEqual({
      or: [
        { scope: { equals: 'school' } },
        { and: [{ scope: { equals: 'group' } }, { group: { in: [9] } }] },
        { and: [{ scope: { equals: 'branch' } }, { branch: { in: [4] } }] },
      ],
    })
  })
})

describe('allowedChatTargets', () => {
  it('демо-coach: school:false — не создаёт тему всей школы (D-029/C1)', async () => {
    const find = vi.fn().mockResolvedValueOnce({ docs: [{ id: 9, branch: 4 }] }).mockResolvedValueOnce({ docs: [] })
    const demoCoach = { id: 2, roles: ['coach'], demo: true }
    const allowed = await allowedChatTargets({ user: demoCoach, payload: { find } } as never)
    expect(allowed.school).toBe(false)
  })

  it('живой coach: school:true (регрессия C1)', async () => {
    const find = vi.fn().mockResolvedValueOnce({ docs: [{ id: 9, branch: 4 }] }).mockResolvedValueOnce({ docs: [] })
    const coach = { id: 3, roles: ['coach'] }
    const allowed = await allowedChatTargets({ user: coach, payload: { find } } as never)
    expect(allowed.school).toBe(true)
  })
})
