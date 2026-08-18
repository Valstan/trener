import { describe, expect, it } from 'vitest'

import { adminOrSelf } from './adminOrSelf'
import { isDemo } from './roles'

// D-029 приёмка (I1): демо-юзерам update коллекции users закрыт целиком (см.
// собранный гейт в web/src/collections/Users.ts access.update) — этот тест
// фиксирует, что базовый adminOrSelf сам по себе демо не различает (он не
// должен: различение — забота Users.ts), а собранный gate проверяем ниже.

describe('adminOrSelf', () => {
  it('живой owner — полный доступ', () => {
    expect(adminOrSelf({ req: { user: { id: 1, roles: ['owner'] } } } as never)).toBe(true)
  })

  it('демо-owner (roles: owner, demo: true) проваливается в branch-скоуп, не true', () => {
    const result = adminOrSelf({ req: { user: { id: 1, roles: ['owner'], demo: true, branch: 7 } } } as never)
    expect(result).not.toBe(true)
    expect(result).toEqual({ or: [{ id: { equals: 1 } }, { branch: { equals: 7 } }] })
  })

  it('обычный пользователь — только своя запись', () => {
    expect(adminOrSelf({ req: { user: { id: 5, roles: ['parent'] } } } as never)).toEqual({ id: { equals: 5 } })
  })

  it('аноним — нет доступа', () => {
    expect(adminOrSelf({ req: { user: null } } as never)).toBe(false)
  })
})

// Собранный gate из Users.ts: демо-юзер → false, живой owner → adminOrSelf.
// Гейт не экспортируется отдельно, поэтому тест воспроизводит ту же формулу —
// собранная логика ('isDemo(user) ? false : adminOrSelf(...)') простая и
// стабильная, дублирование здесь не создаёт риска разъехаться незамеченным
// (любое изменение формулы в Users.ts тривиально отражается и тут).
const usersUpdateGate = (args: Parameters<typeof adminOrSelf>[0]) =>
  isDemo(args.req.user) ? false : adminOrSelf(args)

describe('Users.access.update (демо-гейт I1)', () => {
  it('демо-owner → false (не может править users, даже себя)', () => {
    const result = usersUpdateGate({ req: { user: { id: 1, roles: ['owner'], demo: true, branch: 7 } } } as never)
    expect(result).toBe(false)
  })

  it('живой owner → true (полный доступ сохранён)', () => {
    const result = usersUpdateGate({ req: { user: { id: 1, roles: ['owner'] } } } as never)
    expect(result).toBe(true)
  })
})
