import type { Access } from 'payload'

import { isAdmin } from './roles'

// Админ читает/правит всех; любой другой пользователь — только свою запись.
export const adminOrSelf: Access = ({ req: { user } }) => {
  if (!user) return false
  if (isAdmin(user)) return true
  return {
    id: {
      equals: user.id,
    },
  }
}
