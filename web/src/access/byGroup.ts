import type { Access } from 'payload'

import { coachGroupIds, isAdmin, isCoach } from './roles'

// Запись/удаление записей, привязанных к группе (Players, TrainingSessions):
// админ — все; тренер — только записи СВОИХ групп (по полю group). Остальные — нет.
export const adminOrCoachOwnGroup: Access = async ({ req }) => {
  const { user } = req
  if (!user) return false
  if (isAdmin(user)) return true
  if (isCoach(user)) {
    const ids = await coachGroupIds(req, user.id)
    if (!ids.length) return false
    return { group: { in: ids } }
  }
  return false
}
