import type { Access } from 'payload'

import { isFullOwner } from './roles'

// God-гейт: только ЖИВОЙ владелец сети (до M5 — роль admin). Демо-owner (D-029)
// сюда не проваливается — структурные/служебные коллекции ему недоступны.
// Используется на закрытых client-write путях (update/delete служебных
// коллекций) и структурных операциях.
export const adminOnly: Access = ({ req: { user } }) => isFullOwner(user)
