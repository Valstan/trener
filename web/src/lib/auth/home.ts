import { isAdmin, isCoach, isParent } from '@/access/roles'

// Домашний экран пользователя по роли — единый источник для:
//   • редиректа после входа (/auth/complete-login),
//   • редиректа залогиненного с публичного лендинга '/'.
//
// Без него вход «зацикливался»: complete-login вёл на '/', а '/' — статический
// лендинг с кнопкой «Войти», т.е. вошедший попадал обратно на экран входа.
//
// admin → админка Payload (его рабочее место — панель координатора);
// coach → расписание со сводкой coverage; parent → очередь изменений.
// Неизвестная/пустая роль → '/' (на лендинге это значит «не редиректим», без петли).
export const homePathForUser = (user: { roles?: string[] | null } | null | undefined): string => {
  if (!user) return '/'
  if (isAdmin(user)) return '/admin'
  if (isCoach(user)) return '/coach/schedule'
  if (isParent(user)) return '/parent'
  return '/'
}
