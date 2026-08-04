import { describe, expect, it, vi } from 'vitest'

import { PaymentMessages, PaymentThreads, readPaymentMessages, readPaymentThreads } from './PaymentThreads'

describe('payment chat access', () => {
  it('родитель видит только свои нити', () => {
    expect(readPaymentThreads({ req: { user: { id: 7, roles: ['parent'] } } } as never)).toEqual({ parent: { equals: 7 } })
  })

  it('владелец видит все, тренер — ничего', () => {
    expect(readPaymentThreads({ req: { user: { id: 1, roles: ['owner'] } } } as never)).toBe(true)
    expect(readPaymentThreads({ req: { user: { id: 2, roles: ['coach'] } } } as never)).toBe(false)
  })

  it('сообщения родителя ограничены id его нитей', async () => {
    const find = vi.fn().mockResolvedValue({ docs: [{ id: 11 }, { id: 12 }] })
    await expect(readPaymentMessages({ req: { user: { id: 7, roles: ['parent'] }, payload: { find } } } as never)).resolves.toEqual({ thread: { in: [11, 12] } })
  })

  it('историю нельзя менять или удалять через API', () => {
    expect(PaymentThreads.access?.update?.({} as never)).toBe(false)
    expect(PaymentThreads.access?.delete?.({} as never)).toBe(false)
    expect(PaymentMessages.access?.update?.({} as never)).toBe(false)
    expect(PaymentMessages.access?.delete?.({} as never)).toBe(false)
  })
})
