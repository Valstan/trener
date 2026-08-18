import { describe, expect, it, vi } from 'vitest'

import { loadOwnerBranch } from './ownerBranch'

// D-029: демо-owner не должен получать полный список живых филиалов через
// overrideAccess-путь loadOwnerBranch — его скоуп задаёт authz (adminBranchId),
// а не UI-контекст владельца. payload.find НЕ должен вызываться вовсе.
describe('loadOwnerBranch', () => {
  it('демо-owner — нейтральный результат, payload.find НЕ вызывается', async () => {
    const find = vi.fn()
    const res = await loadOwnerBranch({ find } as never, { roles: ['owner'], demo: true })
    expect(res).toEqual({ branches: null, ctx: null, ctxGroupIds: null })
    expect(find).not.toHaveBeenCalled()
  })

  it('не-owner — нейтральный результат', async () => {
    const find = vi.fn()
    const res = await loadOwnerBranch({ find } as never, { roles: ['coach'] })
    expect(res).toEqual({ branches: null, ctx: null, ctxGroupIds: null })
    expect(find).not.toHaveBeenCalled()
  })
})
