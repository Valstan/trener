import type { FieldAccess, PayloadRequest } from 'payload'

// ─────────────────────────────────────────────────────────────────────────────
// Роли и скоупинг доступа (#015 — day-1, серверный write-authz = клиентский edit-gate).
//
// Три роли: admin | coach | parent.
//   • admin  — структура школы, пользователи, оверсайт.
//   • coach  — правит ТОЛЬКО свои группы и их данные (расписание, дети группы).
//   • parent — видит ТОЛЬКО своих детей и расписание их групп.
//
// Скоупинг тренера и родителя — это и есть ров (coverage «приняли N из M»):
// корректность держится на точной привязке тренер→группа и родитель→ребёнок,
// поэтому это закладывается с первого дня, а не «при росте».
// ─────────────────────────────────────────────────────────────────────────────

type Roleish = { roles?: string[] | null } | null | undefined

export const hasRole = (user: Roleish, ...roles: string[]): boolean =>
  Boolean(user && Array.isArray(user.roles) && roles.some((r) => user.roles!.includes(r)))

export const isAdmin = (user: Roleish): boolean => hasRole(user, 'admin')
export const isCoach = (user: Roleish): boolean => hasRole(user, 'coach')
export const isParent = (user: Roleish): boolean => hasRole(user, 'parent')

// Field-level: разрешить задавать значение поля только персоналу (admin/coach).
// Если доступа нет — Payload отбрасывает присланное значение и применяет defaultValue.
export const adminOrStaffField: FieldAccess = ({ req: { user } }) => hasRole(user, 'admin', 'coach')

// Field-level: менять может только админ (напр. роли — защита от самоповышения).
export const adminField: FieldAccess = ({ req: { user } }) => hasRole(user, 'admin')

// ─── Кросс-коллекционный скоупинг (async access, возвращает Where) ───────────
// Все служебные find'ы идут с overrideAccess: true — это разрывает рекурсию
// (find по 'groups' иначе снова дёрнул бы access read коллекции groups).

// ID групп, где данный пользователь — тренер.
export const coachGroupIds = async (
  req: PayloadRequest,
  userId: string | number,
): Promise<(string | number)[]> => {
  const res = await req.payload.find({
    collection: 'groups',
    where: { coaches: { in: [userId] } },
    depth: 0,
    limit: 1000,
    pagination: false,
    overrideAccess: true,
  })
  return res.docs.map((doc) => doc.id)
}

// ID групп, где у данного родителя есть ребёнок.
export const parentGroupIds = async (
  req: PayloadRequest,
  userId: string | number,
): Promise<(string | number)[]> => {
  const res = await req.payload.find({
    collection: 'players',
    where: { parent: { equals: userId } },
    depth: 0,
    limit: 1000,
    pagination: false,
    overrideAccess: true,
  })
  const ids = res.docs
    .map((doc) => (typeof doc.group === 'object' && doc.group !== null ? doc.group.id : doc.group))
    .filter((g): g is number => typeof g === 'number')
  return Array.from(new Set(ids))
}
