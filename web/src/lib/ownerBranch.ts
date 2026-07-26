import type { Payload } from 'payload'

import { isOwner } from '@/access/roles'
import { readBranchCtx } from '@/lib/branchContext'

// Контекст филиала владельца для coach-экранов (M5 PR-D). Для не-owner — нейтрально
// (всё null): их скоуп задаёт authz. Для owner: список филиалов (селектор) + выбранный
// филиал из cookie (протухший id молча сбрасывается) + группы филиала для фильтров.
// Служебные find — overrideAccess (G90), фильтры плоскими списками id (критик H2).
export type OwnerBranchCtx = {
  branches: { id: number; name: string }[] | null
  ctx: number | null
  ctxGroupIds: number[] | null
}

export const loadOwnerBranch = async (
  payload: Payload,
  user: { roles?: string[] | null } | null | undefined,
): Promise<OwnerBranchCtx> => {
  if (!isOwner(user)) return { branches: null, ctx: null, ctxGroupIds: null }

  const branches = (
    await payload.find({
      collection: 'branches',
      sort: 'name',
      limit: 200,
      depth: 0,
      pagination: false,
      overrideAccess: true,
    })
  ).docs.map((b) => ({ id: b.id, name: b.name }))

  let ctx = await readBranchCtx()
  if (ctx != null && !branches.some((b) => b.id === ctx)) ctx = null

  let ctxGroupIds: number[] | null = null
  if (ctx != null) {
    ctxGroupIds = (
      await payload.find({
        collection: 'groups',
        where: { branch: { equals: ctx } },
        depth: 0,
        limit: 1000,
        pagination: false,
        overrideAccess: true,
      })
    ).docs.map((g) => g.id)
  }

  return { branches, ctx, ctxGroupIds }
}
