import type { Access } from 'payload'

import { isAdmin } from './roles'

export const adminOnly: Access = ({ req: { user } }) => isAdmin(user)
