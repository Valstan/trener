import type { Access } from 'payload'

import { isAdmin } from './roles'

// Скоупинг «только свои записи» по произвольному relationship-полю, ссылающемуся
// на пользователя (#015). Админ — все; остальные — только записи, где <field> == user.id.
//
// Отличие от `adminOrSelf` (который фильтрует по `id` САМОЙ записи, т.е. для коллекции
// users): здесь фильтр по полю-ссылке внутри другой коллекции — `user`/`parent`.
// Критик M2 (M7) специально отметил: переиспользовать adminOrSelf тут НЕЛЬЗЯ —
// он сравнивает id записи, а не значение relationship-поля.
export const selfByField =
  (field: string): Access =>
  ({ req: { user } }) => {
    if (!user) return false
    if (isAdmin(user)) return true
    return { [field]: { equals: user.id } }
  }

// Подписки на пуш (Devices) — владелец по полю `user`.
export const selfByUser = selfByField('user')

// Уведомления / RSVP (Notifications, Rsvps) — адресат/ответивший по полю `parent`.
export const selfByParent = selfByField('parent')
