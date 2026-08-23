import type { CollectionBeforeValidateHook } from 'payload'

import { adminBranchId, branchGroupIds, coachGroupIds, isFullOwner } from '../access/roles'
import { branchIdsForGroups } from '../access/chatScope'

// Гейт «тема заводится только в СВОЮ цель» (M9, скоупы M9.5).
//
// ⚠️ Почему хук, а не одно лишь `access.create`. Access-функция, вернувшая Where,
// ограничивает выборку — но на СОЗДАНИИ фильтровать нечего, и Payload читает такой
// ответ просто как «можно». Проверено вживую 30.07: тренер филиала «Вятские Поляны»
// создал тему в группе «Малмыжа» и получил 200. Та же грабля уже обходилась вручную
// в /coach/session и /coach/match — здесь закрываем её на уровне коллекции, чтобы
// дыра не открылась заново через REST или админку.
//
// Скоупы: group → своя группа (тренер) / группа своего филиала (админ);
// branch → филиал своих групп (тренер) / свой филиал (админ); school → границу
// «кто вообще может» держат маршрут и access (владелец/тренер по матрице ролей).
//
// Без `req.user` (служебные пути с overrideAccess — сид, миграции данных) не мешаем:
// там вызывающий и так действует от имени системы. Server-mediated маршруты обязаны
// передавать `user` в payload.create — иначе гейт слеп (см. /chat/topic).
export const guardTopicGroup: CollectionBeforeValidateHook = async ({ data, req, originalDoc }) => {
  if (!data) return data
  const user = req?.user
  // isFullOwner, не isOwner: демо-владелец (roles:['owner']) должен скоупиться демо-филиалом
  // через ветку adminBranchId ниже, иначе заводил бы темы в живых группах (D-029/#166).
  if (!user || isFullOwner(user)) return data

  const scope = data.scope ?? originalDoc?.scope ?? 'group'
  if (scope === 'school') return data

  const adminBranch = adminBranchId(user)

  if (scope === 'branch') {
    const branchRaw = data.branch ?? originalDoc?.branch
    const branchId = typeof branchRaw === 'object' && branchRaw !== null ? (branchRaw as { id: number }).id : branchRaw
    if (typeof branchId !== 'number') throw new Error('У темы филиала должен быть филиал')
    const allowedBranches =
      adminBranch != null ? [adminBranch] : await branchIdsForGroups(req, await coachGroupIds(req, user.id))
    if (!allowedBranches.map(String).includes(String(branchId))) {
      throw new Error('Тему можно завести только в своём филиале')
    }
    return data
  }

  const groupId = data.group ?? originalDoc?.group
  const id = typeof groupId === 'object' && groupId !== null ? (groupId as { id: number }).id : groupId
  if (typeof id !== 'number') throw new Error('У темы должна быть группа')

  const allowed = adminBranch != null ? await branchGroupIds(req, adminBranch) : await coachGroupIds(req, user.id)
  if (!allowed.includes(id)) {
    throw new Error('Тему можно завести только в своей группе')
  }
  return data
}
