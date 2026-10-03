import { describe, expect, it } from 'vitest'

import { Consents } from './Consents'

// Аудит #015: `create: Boolean(user)` позволял через REST `POST /api/consents`
// создать согласие «родитель дал согласие» за ЛЮБОГО родителя — это запись
// 152-ФЗ-контура. Теперь create требует права на самого родителя: родитель —
// только на себя, персонал (owner/admin) — без ограничения.
const create = Consents.access?.create as (args: {
  req: { user: unknown }
  data?: Record<string, unknown>
}) => boolean | Promise<boolean>

const call = async (args: Parameters<typeof create>[0]): Promise<boolean> =>
  await Promise.resolve(create(args))

describe('consents.create: согласие пишется только за себя (или персоналом)', () => {
  it('аноним — нельзя', async () => {
    await expect(call({ req: { user: null } })).resolves.toBe(false)
  })

  it('родитель — только за себя (числом и объектом)', async () => {
    const user = { id: 42, roles: ['parent'] }
    await expect(call({ req: { user }, data: { parent: 42 } })).resolves.toBe(true)
    await expect(call({ req: { user }, data: { parent: { id: 42 } } })).resolves.toBe(true)
    await expect(call({ req: { user }, data: { parent: 7 } })).resolves.toBe(false)
    await expect(call({ req: { user }, data: {} })).resolves.toBe(false)
  })

  it('персонал (owner/admin) — без ограничения, но роль проверяется', async () => {
    await expect(call({ req: { user: { id: 1, roles: ['owner'] } } })).resolves.toBe(true)
    await expect(call({ req: { user: { id: 2, roles: ['admin'], branch: 3 } } })).resolves.toBe(true)
    await expect(call({ req: { user: { id: 3, roles: ['coach'] } } })).resolves.toBe(false)
  })
})
