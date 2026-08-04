import { describe, expect, it } from 'vitest'

import { ChildRegistrations } from './ChildRegistrations'

describe('child registration access', () => {
  it('родитель видит только заявки, направленные ему', () => {
    expect(ChildRegistrations.access?.read?.({ req: { user: { id: 7, roles: ['parent'] } } } as never)).toEqual({ proposedParent: { equals: 7 } })
  })

  it('владелец видит все заявки, посторонний — ни одной', () => {
    expect(ChildRegistrations.access?.read?.({ req: { user: { id: 1, roles: ['owner'] } } } as never)).toBe(true)
    expect(ChildRegistrations.access?.read?.({ req: { user: { id: 2, roles: ['coach'] } } } as never)).toBe(false)
  })

  it('создание и изменение доступны только через проверенные маршруты', () => {
    expect(ChildRegistrations.access?.create?.({} as never)).toBe(false)
    expect(ChildRegistrations.access?.update?.({} as never)).toBe(false)
  })
})
