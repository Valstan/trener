import type { CollectionBeforeValidateHook } from 'payload'

import { adminBranchId, branchGroupIds, coachGroupIds, isOwner } from '../access/roles'

// Гейт «тема заводится только в СВОЮ группу» (M9).
//
// ⚠️ Почему хук, а не одно лишь `access.create`. Access-функция, вернувшая Where,
// ограничивает выборку — но на СОЗДАНИИ фильтровать нечего, и Payload читает такой
// ответ просто как «можно». Проверено вживую 30.07: тренер филиала «Вятские Поляны»
// создал тему в группе «Малмыжа» и получил 200. Та же грабля уже обходилась вручную
// в /coach/session и /coach/match — здесь закрываем её на уровне коллекции, чтобы
// дыра не открылась заново через REST или админку.
//
// Без `req.user` (служебные пути с overrideAccess — сид, миграции данных) не мешаем:
// там вызывающий и так действует от имени системы.
export const guardTopicGroup: CollectionBeforeValidateHook = async ({ data, req, originalDoc }) => {
  if (!data) return data
  const user = req?.user
  if (!user || isOwner(user)) return data

  const groupId = data.group ?? originalDoc?.group
  const id = typeof groupId === 'object' && groupId !== null ? (groupId as { id: number }).id : groupId
  if (typeof id !== 'number') throw new Error('У темы должна быть группа')

  const branch = adminBranchId(user)
  const allowed = branch != null ? await branchGroupIds(req, branch) : await coachGroupIds(req, user.id)
  if (!allowed.includes(id)) {
    throw new Error('Тему можно завести только в своей группе')
  }
  return data
}
