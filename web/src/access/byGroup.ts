import type { Access } from 'payload'

import {
  adminBranchId,
  branchGroupIds,
  coachGroupIds,
  hasRole,
  isCoach,
  isFullOwner,
} from './roles'

// Запись/удаление записей, привязанных к группе (Players, TrainingSessions):
// владелец — все; филиальный админ — записи групп СВОЕГО филиала (M5); тренер —
// только записи СВОИХ групп (по полю group). Остальные — нет.
// Фильтры — плоскими списками id (не вложенный relationship-where — критик M2 H2).
export const adminOrCoachOwnGroup: Access = async ({ req }) => {
  const { user } = req
  if (!user) return false
  if (isFullOwner(user)) return true
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

// Создание записи, привязанной к группе (Players, TrainingSessions): та же
// скоуп-логика, что update/delete, но применённая к ЗАПРОШЕННОЙ группе —
// на create нет документа для Where-фильтра, поэтому проверяем req.data.group.
// Без этого REST `POST /api/players` / `POST /api/training-sessions` открывал
// запись в чужую группу любому owner/admin/coach (аудит #015).
export const createInOwnGroup: Access = async ({ req, data }) => {
  const { user } = req
  if (!user) return false
  if (!hasRole(user, 'owner', 'admin', 'coach')) return false
  if (isFullOwner(user)) return true
  const raw = (data as { group?: unknown } | undefined)?.group
  const groupId =
    raw != null && typeof raw === 'object'
      ? (raw as { id?: string | number }).id
      : (raw as string | number | null | undefined)
  if (groupId == null) return false
  const branch = adminBranchId(user)
  if (branch != null) {
    const ids = await branchGroupIds(req, branch)
    return ids.some((id) => String(id) === String(groupId))
  }
  if (isCoach(user)) {
    const ids = await coachGroupIds(req, user.id)
    return ids.some((id) => String(id) === String(groupId))
  }
  return false
}
