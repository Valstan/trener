// Повышение «застрявшего» applicant при приглашении (M5/#115 стык).
//
// Сценарий-жертва: человек саморегистрировался (roles=['applicant'], pending),
// а ПОТОМ тренер прислал ему приглашение (родителя или сотрудника). Приглашение —
// это подтверждение участия, но acceptInvite/staff-invite «существующего не трогали»,
// и человек навсегда залипал на /pending с привязанным ребёнком.
//
// Правило: живой аккаунт с содержательной ролью (owner/admin/coach/parent/child) НЕ
// трогаем (анти-перезапись чужого аккаунта, комментарий в staff/invite). Пустой или
// чисто-applicant аккаунт — повышаем до приглашённой роли.
export const applicantUpgrade = <R extends 'parent' | 'coach' | 'admin'>(
  roles: string[] | null | undefined,
  role: R,
): R[] | null => {
  const rs = Array.isArray(roles) ? roles.filter(Boolean) : []
  const substantive = rs.filter((r) => r !== 'applicant')
  if (substantive.length) return null
  return [role]
}
