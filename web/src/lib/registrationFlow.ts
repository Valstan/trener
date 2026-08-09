// Чистые правила инбокса заявок (#115 доводка): переходы статусов детской заявки
// и данные подтверждения взрослого. Вынесено из маршрута /coach/requests/decide,
// чтобы матрица переходов проверялась юнит-тестами.

export type ChildRegStatus = 'owner_review' | 'parent_review' | 'accepted' | 'rejected'

// Отклонить можно всё, что ещё не принято; вернуть на проверку — зависшую у
// родителя или отклонённую (владелец передумал). Принятая заявка неприкосновенна:
// за ней уже стоит созданный player.
export const childTransition = (
  current: ChildRegStatus,
  action: 'reject' | 'reopen',
): ChildRegStatus | null => {
  if (action === 'reject') {
    return current === 'owner_review' || current === 'parent_review' ? 'rejected' : null
  }
  return current === 'parent_review' || current === 'rejected' ? 'owner_review' : null
}

// Подтверждение взрослой заявки: роль строго из requestedRole (владелец не выбирает
// роль в обход воли заявителя), филиал обязателен (без него не работают ни скоупинг,
// ни согласие 152-ФЗ).
export const adultApproveData = (
  requestedRole: string | null | undefined,
  branchId: number | null,
): { roles: ('parent' | 'coach')[]; status: 'approved'; branch: number } | null => {
  if (requestedRole !== 'parent' && requestedRole !== 'coach') return null
  if (branchId == null) return null
  return { roles: [requestedRole], status: 'approved', branch: branchId }
}
