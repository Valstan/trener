import { describe, expect, it, vi } from 'vitest'

import { createInOwnGroup } from './byGroup'

// Аудит #015: на create у Payload нет документа для Where-фильтра, поэтому скоуп
// проверяется по ЗАПРОШЕННОЙ группе (req.data.group). Раньше create у Players и
// TrainingSessions был `hasRole(user,'owner','admin','coach')` — REST-канал
// `POST /api/players` / `POST /api/training-sessions` позволял тренеру/админу
// создать запись в чужой группе, пока update/delete были скоуплены adminOrCoachOwnGroup.
const reqWith = (
  user: unknown,
  groups: { id: number; branch?: number }[],
  coaches: number[] = [],
) => {
  const payload = {
    find: vi.fn(async ({ where }: { where?: unknown }) => {
      const json = JSON.stringify(where ?? '')
      // Запрос по тренеру: where.coaches.in
      if (json.includes('"coaches"')) {
        return {
          docs: groups.filter((g) => coaches.includes(g.id)).map((g) => ({ id: g.id })),
        }
      }
      // Запрос по филиалу: where.branch.equals
      if (json.includes('"branch"')) {
        const branchId = Number(/"branch":\{"equals":(\d+)/.exec(json)?.[1])
        return { docs: groups.filter((g) => g.branch === branchId).map((g) => ({ id: g.id })) }
      }
      return { docs: groups.map((g) => ({ id: g.id })) }
    }),
  }
  return { user, payload } as never
}

describe('createInOwnGroup: создание записи только в своём скоупе', () => {
  const groups = [
    { id: 1, branch: 10 },
    { id: 2, branch: 20 },
  ]

  it('аноним — нельзя', async () => {
    await expect(createInOwnGroup({ req: reqWith(null, groups), data: { group: 1 } } as never)).resolves.toBe(false)
  })

  it('живой owner (сетевой) — любую группу', async () => {
    const req = reqWith({ id: 1, roles: ['owner'], demo: false }, groups)
    await expect(createInOwnGroup({ req, data: { group: 2 } } as never)).resolves.toBe(true)
  })

  it('тренер — только свои группы', async () => {
    const req = reqWith({ id: 5, roles: ['coach'] }, groups, [1])
    await expect(createInOwnGroup({ req, data: { group: 1 } } as never)).resolves.toBe(true)
    await expect(createInOwnGroup({ req, data: { group: 2 } } as never)).resolves.toBe(false)
  })

  it('админ филиала — только группы своего филиала', async () => {
    const req = reqWith({ id: 6, roles: ['admin'], branch: 10 }, groups)
    await expect(createInOwnGroup({ req, data: { group: 1 } } as never)).resolves.toBe(true)
    await expect(createInOwnGroup({ req, data: { group: 2 } } as never)).resolves.toBe(false)
  })

  it('демо-owner скоупится демо-филиалом, а не всей сетью', async () => {
    const req = reqWith({ id: 7, roles: ['owner'], demo: true, branch: 20 }, groups)
    await expect(createInOwnGroup({ req, data: { group: 2 } } as never)).resolves.toBe(true)
    await expect(createInOwnGroup({ req, data: { group: 1 } } as never)).resolves.toBe(false)
  })

  it('родитель/ребёнок — не может создавать записи групп', async () => {
    const req = reqWith({ id: 8, roles: ['parent'] }, groups)
    await expect(createInOwnGroup({ req, data: { group: 1 } } as never)).resolves.toBe(false)
  })

  it('группа не передана или пришла объектом — трактуется по id', async () => {
    const req = reqWith({ id: 5, roles: ['coach'] }, groups, [1])
    await expect(createInOwnGroup({ req, data: { group: { id: 1 } } } as never)).resolves.toBe(true)
    await expect(createInOwnGroup({ req, data: {} } as never)).resolves.toBe(false)
  })
})
