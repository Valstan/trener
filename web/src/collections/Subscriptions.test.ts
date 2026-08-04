import { describe, expect, it, vi } from 'vitest'

import { readSubscriptions } from './Subscriptions'

const callRead = async (user: Record<string, unknown> | null, docs: { id: number }[] = []) => {
  const find = vi.fn().mockResolvedValue({ docs })
  const result = await readSubscriptions({ req: { user, payload: { find } } } as never)
  return { result, find }
}

describe('readSubscriptions', () => {
  it('владелец видит все абонементы', async () => {
    const { result } = await callRead({ id: 1, roles: ['owner'] })
    expect(result).toBe(true)
  })

  it('тренер не видит оплату даже своих групп', async () => {
    const { result, find } = await callRead({ id: 2, roles: ['coach'] }, [{ id: 10 }])
    expect(result).toBe(false)
    expect(find).not.toHaveBeenCalled()
  })

  it('родитель видит абонементы только своих детей', async () => {
    const { result, find } = await callRead({ id: 3, roles: ['parent'] }, [{ id: 10 }, { id: 11 }])
    expect(find).toHaveBeenCalledWith(expect.objectContaining({
      collection: 'players',
      where: { parent: { equals: 3 } },
      overrideAccess: true,
    }))
    expect(result).toEqual({ player: { in: [10, 11] } })
  })
})
