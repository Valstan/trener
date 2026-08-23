import { describe, expect, it, vi } from 'vitest'

import { staffCanManageGroup } from './groupScope'

// Граница D-029/#166: демо-владелец (roles:['owner'], demo:true) — НЕ живой владелец.
// Он скоупится своим демо-филиалом, как branch-admin; живой владелец — любая группа;
// тренер — только группы, где он в coaches.

type FindArgs = { collection: string; where: Record<string, unknown> }

const payloadWith = (groupsByQuery: (args: FindArgs) => { id: number }[]) =>
  ({
    find: vi.fn(async (args: FindArgs) => ({ docs: groupsByQuery(args) })),
  }) as never

const demoOwner = { id: 10, roles: ['owner'], branch: 4, demo: true } as never
const liveOwner = { id: 1, roles: ['owner'], branch: null, demo: false } as never
const branchAdmin = { id: 5, roles: ['admin'], branch: 1, demo: false } as never
const coach = { id: 7, roles: ['coach'], branch: null, demo: false } as never

describe('staffCanManageGroup', () => {
  it('живой владелец — любая группа, без запроса к БД', async () => {
    const payload = payloadWith(() => [])
    expect(await staffCanManageGroup(payload, liveOwner, 1)).toBe(true)
    expect((payload as { find: ReturnType<typeof vi.fn> }).find).not.toHaveBeenCalled()
  })

  it('демо-владелец — только группы СВОЕГО (демо) филиала, не живые', async () => {
    const payload = payloadWith((args) =>
      (args.where as { branch?: { equals: number } }).branch?.equals === 4 ? [{ id: 14 }, { id: 15 }] : [],
    )
    expect(await staffCanManageGroup(payload, demoOwner, 14)).toBe(true)
    expect(await staffCanManageGroup(payload, demoOwner, 1)).toBe(false) // живая группа
    expect(await staffCanManageGroup(payload, demoOwner, '15')).toBe(true) // строковый id тоже
  })

  it('branch-admin — группы своего филиала', async () => {
    const payload = payloadWith((args) =>
      (args.where as { branch?: { equals: number } }).branch?.equals === 1 ? [{ id: 1 }, { id: 2 }] : [],
    )
    expect(await staffCanManageGroup(payload, branchAdmin, 2)).toBe(true)
    expect(await staffCanManageGroup(payload, branchAdmin, 3)).toBe(false)
  })

  it('тренер — только группы, где он в coaches', async () => {
    const payload = payloadWith((args) =>
      (args.where as { coaches?: { in: number[] } }).coaches?.in?.includes(7) ? [{ id: 3 }] : [],
    )
    expect(await staffCanManageGroup(payload, coach, 3)).toBe(true)
    expect(await staffCanManageGroup(payload, coach, 1)).toBe(false)
  })
})
