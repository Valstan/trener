import type { Access, PayloadRequest, Where } from 'payload'

import { adminBranchId, branchGroupIds, childGroupIds, coachGroupIds, isChild, isCoach, isOwner, isParent, parentGroupIds } from './roles'

const branchIdsForGroups = async (req: PayloadRequest, groupIds: (string | number)[]): Promise<(string | number)[]> => {
  if (!groupIds.length) return []
  const groups = await req.payload.find({ collection: 'groups', where: { id: { in: groupIds } }, depth: 0, limit: 1000, pagination: false, overrideAccess: true })
  return Array.from(new Set(groups.docs.map((group) => typeof group.branch === 'object' && group.branch ? group.branch.id : group.branch).filter((id): id is number => typeof id === 'number')))
}

export const chatScopeForUser = async (req: PayloadRequest): Promise<true | Where | false> => {
  const user = req.user
  if (!user) return false
  if (isOwner(user)) return true
  if (isChild(user)) {
    const groups = await childGroupIds(req, user.id)
    return groups.length ? { and: [{ scope: { equals: 'group' } }, { group: { in: groups } }, { room: { equals: 'children' } }] } : false
  }
  const adminBranch = adminBranchId(user)
  const groups = adminBranch != null ? [] : isCoach(user) ? await coachGroupIds(req, user.id) : isParent(user) ? await parentGroupIds(req, user.id) : []
  const branches = adminBranch != null ? [adminBranch] : await branchIdsForGroups(req, groups)
  const clauses: Where[] = [{ scope: { equals: 'school' } }]
  if (groups.length) clauses.push(isParent(user)
    ? { and: [{ scope: { equals: 'group' } }, { group: { in: groups } }, { room: { equals: 'adults' } }] }
    : { and: [{ scope: { equals: 'group' } }, { group: { in: groups } }] })
  if (branches.length) clauses.push({ and: [{ scope: { equals: 'branch' } }, { branch: { in: branches } }] })
  return clauses.length ? { or: clauses } : false
}

export const readChatScope: Access = ({ req }) => chatScopeForUser(req)

export const allowedChatTargets = async (req: PayloadRequest): Promise<{ groups: (string | number)[]; branches: (string | number)[]; school: boolean }> => {
  const user = req.user
  if (!user || isChild(user) || isParent(user)) return { groups: [], branches: [], school: false }
  if (isOwner(user)) return { groups: [], branches: [], school: true }
  const adminBranch = adminBranchId(user)
  if (adminBranch != null) return { groups: await branchGroupIds(req, adminBranch), branches: [adminBranch], school: false }
  const ownGroups = isCoach(user) ? await coachGroupIds(req, user.id) : []
  const branches = await branchIdsForGroups(req, ownGroups)
  const groups = (await Promise.all(branches.map((branch) => branchGroupIds(req, branch)))).flat()
  return { groups, branches, school: isCoach(user) }
}
