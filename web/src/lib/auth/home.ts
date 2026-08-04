import { isAdmin, isChild, isCoach, isOwner, isParent, isPending } from '@/access/roles'

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
export const homePathForUser = (
  user: { roles?: string[] | null; status?: string | null } | null | undefined,
): string => {
  if (!user) return '/'
  // Модерация входа (M5 PR-B): неподтверждённый участник — на экран ожидания.
  if (isPending(user)) return '/pending'
  // owner и админ филиала работают в панели координатора (M5).
  if (isOwner(user) || isAdmin(user)) return '/admin'
  if (isCoach(user)) return '/coach/schedule'
  if (isParent(user)) return '/parent'
  if (isChild(user)) return '/child'
  return '/'
}
