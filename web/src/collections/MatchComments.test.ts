import { describe, expect, it, vi } from 'vitest'

import { MatchComments } from './MatchComments'
import { readMatchParticipants } from './Matches'

describe('match comments access', () => {
  it('ребёнок видит матчи только своей текущей группы', async () => {
    const find = vi.fn().mockResolvedValue({ docs: [{ group: 9 }] })
    await expect(readMatchParticipants({ req: { user: { id: 4, roles: ['child'] }, payload: { find } } } as never)).resolves.toEqual({ group: { in: [9] } })
  })

  it('родитель видит матчи групп своих детей', async () => {
    const find = vi.fn().mockResolvedValue({ docs: [{ group: 7 }, { group: 8 }] })
    await expect(readMatchParticipants({ req: { user: { id: 5, roles: ['parent'] }, payload: { find } } } as never)).resolves.toEqual({ group: { in: [7, 8] } })
  })

  it('комментарии создаются только проверенным маршрутом и не редактируются', () => {
    expect(MatchComments.access?.create?.({} as never)).toBe(false)
    expect(MatchComments.access?.update?.({} as never)).toBe(false)
  })

  it('удалять комментарий может только владелец школы', () => {
    expect(MatchComments.access?.delete?.({ req: { user: { roles: ['owner'] } } } as never)).toBe(true)
    expect(MatchComments.access?.delete?.({ req: { user: { roles: ['coach'] } } } as never)).toBe(false)
  })
})
