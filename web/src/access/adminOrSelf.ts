import type { Access, Where } from 'payload'

import { adminBranchId, isFullOwner } from './roles'

// Коллекция users: живой владелец читает/правит всех; демо-owner проваливается в
// branch-скоуп ниже (D-029); филиальный админ — пользователей СВОЕГО филиала
// (users.branch, M5) и себя; любой другой — только свою запись.
export const adminOrSelf: Access = ({ req: { user } }) => {
  if (!user) return false
  if (isFullOwner(user)) return true
  const branch = adminBranchId(user)
  if (branch != null) {
    const where: Where = { or: [{ id: { equals: user.id } }, { branch: { equals: branch } }] }
    return where
  }
  return {
    id: {
      equals: user.id,
    },
  }
}
