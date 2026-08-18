import { describe, expect, it, vi } from 'vitest'
import type { PayloadRequest } from 'payload'

import { demoGuestLimit } from './demoGuestLimit'
import { DEMO_LIMIT_MESSAGE } from '../lib/demo/constants'

// demoGuestLimit — лимит 5 «своих» сущностей на раздел для демо-посетителя (D-029).
// Логика чистая (req.payload.count мокается), сеть/БД в тесте не участвует.

const makeReq = (demo: boolean | undefined, totalDocs: number): PayloadRequest => {
  const count = vi.fn().mockResolvedValue({ totalDocs })
  return {
    user: demo === undefined ? null : { id: 1, demo },
    payload: { count },
  } as unknown as PayloadRequest
}

const collection = { slug: 'groups' } as never

describe('demoGuestLimit', () => {
  it('не-демо пользователь: data без изменений, count не вызывается', async () => {
    const req = makeReq(false, 0)
    const data = { name: 'Группа' }
    const result = await demoGuestLimit({ req, operation: 'create', data, collection } as never)
    expect(result).toBe(data)
    expect((req.payload.count as ReturnType<typeof vi.fn>)).not.toHaveBeenCalled()
  })

  it('без пользователя (гость без сессии): data без изменений', async () => {
    const req = makeReq(undefined, 0)
    const data = { name: 'Группа' }
    const result = await demoGuestLimit({ req, operation: 'create', data, collection } as never)
    expect(result).toBe(data)
  })

  it('операция update у демо-пользователя: data без изменений, count не вызывается', async () => {
    const req = makeReq(true, 1)
    const data = { name: 'Группа' }
    const result = await demoGuestLimit({ req, operation: 'update', data, collection } as never)
    expect(result).toBe(data)
    expect((req.payload.count as ReturnType<typeof vi.fn>)).not.toHaveBeenCalled()
  })

  it('демо create при count<5: проставляет demoGuest:true', async () => {
    const req = makeReq(true, 4)
    const data = { name: 'Группа' }
    const result = (await demoGuestLimit({ req, operation: 'create', data, collection } as never)) as Record<
      string,
      unknown
    >
    expect(result.demoGuest).toBe(true)
    expect(result.name).toBe('Группа')
    expect(req.payload.count).toHaveBeenCalledWith({
      collection: 'groups',
      where: { demoGuest: { equals: true } },
      overrideAccess: true,
    })
  })

  it('демо create при count>=5: бросает с текстом лимита', async () => {
    const req = makeReq(true, 5)
    const data = { name: 'Группа' }
    await expect(
      demoGuestLimit({ req, operation: 'create', data, collection } as never),
    ).rejects.toThrow(DEMO_LIMIT_MESSAGE)
  })
})
