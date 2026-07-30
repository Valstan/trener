import type { Access } from 'payload'

import {
  adminBranchId,
  branchGroupIds,
  coachGroupIds,
  isCoach,
  isOwner,
  isParent,
  parentGroupIds,
} from './roles'

// Запись/удаление записей, привязанных к группе (Players, TrainingSessions):
// владелец — все; филиальный админ — записи групп СВОЕГО филиала (M5); тренер —
// только записи СВОИХ групп (по полю group). Остальные — нет.
// Фильтры — плоскими списками id (не вложенный relationship-where — критик M2 H2).
export const adminOrCoachOwnGroup: Access = async ({ req }) => {
  const { user } = req
  if (!user) return false
  if (isOwner(user)) return true
  const branch = adminBranchId(user)
  if (branch != null) {
    const ids = await branchGroupIds(req, branch)
    if (!ids.length) return false
    return { group: { in: ids } }
  }
  if (isCoach(user)) {
    const ids = await coachGroupIds(req, user.id)
    if (!ids.length) return false
    return { group: { in: ids } }
  }
  return false
}

// Чтение записей, привязанных к группе, ВСЕМИ участниками группы — включая родителя
// (M9, комнаты чатов): владелец — все; админ филиала — группы своего филиала; тренер —
// свои группы; родитель — группы своих детей.
//
// Отличие от `adminOrCoachOwnGroup`: тот про запись (родителю в ней делать нечего),
// этот — про чтение общей комнаты, где родитель полноправный участник. Фильтры —
// плоскими списками id, как везде: вложенный relationship-where бьёт по планам запросов.
export const groupParticipantRead: Access = async ({ req }) => {
  const { user } = req
  if (!user) return false
  if (isOwner(user)) return true
  const branch = adminBranchId(user)
  if (branch != null) {
    const ids = await branchGroupIds(req, branch)
    if (!ids.length) return false
    return { group: { in: ids } }
  }
  if (isCoach(user)) {
    const ids = await coachGroupIds(req, user.id)
    if (!ids.length) return false
    return { group: { in: ids } }
  }
  if (isParent(user)) {
    const ids = await parentGroupIds(req, user.id)
    if (!ids.length) return false
    return { group: { in: ids } }
  }
  return false
}
