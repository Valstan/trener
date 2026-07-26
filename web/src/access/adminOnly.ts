import type { Access } from 'payload'

import { isOwner } from './roles'

// God-гейт: только владелец сети (до M5 — роль admin). Используется на закрытых
// client-write путях (update/delete служебных коллекций) и структурных операциях.
export const adminOnly: Access = ({ req: { user } }) => isOwner(user)
