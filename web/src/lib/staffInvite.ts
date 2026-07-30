// Разбор приглашения сотрудника (п.5 аудита 30.07): до этого завести тренера можно
// было только через админку Payload, а форма создания пользователя ТРЕБУЕТ пароль —
// владелец придумывал его и передавал руками в мессенджере. Здесь вход тот же, что
// у родителей: ссылка на email.

export type StaffInviteInput = {
  email: string
  name: string
  // Только эти две роли: owner раздаёт себя сам, parent приходит по приглашению
  // к ребёнку.
  role: 'coach' | 'admin'
  branchId: number | null
  groupIds: number[]
}

const MAX_NAME = 120

// Намеренно нестрогая проверка: единственный смысл — не пустить в очередь отправки
// заведомый мусор. Настоящая проверка адреса — само письмо, которое или дойдёт, или нет.
const looksLikeEmail = (v: string): boolean => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)

export const parseStaffInvite = (raw: unknown): StaffInviteInput | null => {
  if (typeof raw !== 'object' || raw === null) return null
  const r = raw as Record<string, unknown>

  const email = typeof r.email === 'string' ? r.email.trim().toLowerCase() : ''
  if (!looksLikeEmail(email)) return null

  const name = typeof r.name === 'string' ? r.name.trim().slice(0, MAX_NAME) : ''
  if (!name) return null

  const role = r.role === 'admin' ? 'admin' : r.role === 'coach' ? 'coach' : null
  if (!role) return null

  const branchId =
    typeof r.branchId === 'number' && Number.isInteger(r.branchId) && r.branchId > 0 ? r.branchId : null

  const groupIds = Array.isArray(r.groupIds)
    ? [...new Set(r.groupIds.filter((v): v is number => typeof v === 'number' && Number.isInteger(v) && v > 0))]
    : []

  return { email, name, role, branchId, groupIds }
}
