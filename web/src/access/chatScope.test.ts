import { describe, expect, it, vi } from 'vitest'

import { chatScopeForUser } from './chatScope'

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
})
