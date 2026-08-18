import type { FieldAccess, PayloadRequest } from 'payload'

// ─────────────────────────────────────────────────────────────────────────────
// Роли и скоупинг доступа (#015 — day-1, серверный write-authz = клиентский edit-gate).
//
// Пять ролей: owner | admin | coach | parent | child.
//   • owner  — владелец сети: все филиалы, структура, назначение ролей.
//   • admin  — администратор СВОЕГО филиала (users.branch): участники и группы
//              филиала; не создаёт филиалы и не назначает owner/admin.
//   • coach  — правит ТОЛЬКО свои группы и их данные (расписание, дети группы).
//   • parent — видит ТОЛЬКО своих детей и расписание их групп.
//
// До M5 роль god-уровня называлась `admin`; миграцией batch 6 такие пользователи
// переведены в `owner`, а `admin` переопределён как филиальный администратор.
//
// Скоупинг тренера и родителя — это и есть ров (coverage «приняли N из M»):
// корректность держится на точной привязке тренер→группа и родитель→ребёнок,
// поэтому это закладывается с первого дня, а не «при росте».
// ─────────────────────────────────────────────────────────────────────────────

type Roleish = { roles?: string[] | null } | null | undefined
type Branchish = Roleish & {
  demo?: boolean | null
  branch?: { id: string | number } | string | number | null
}

export const hasRole = (user: Roleish, ...roles: string[]): boolean =>
  Boolean(user && Array.isArray(user.roles) && roles.some((r) => user.roles!.includes(r)))

export const isOwner = (user: Roleish): boolean => hasRole(user, 'owner')

// Демо-режим (D-029): поле users.demo (saveToJWT) — пользователь порождён
// демо-туром, а не живой регистрацией. Флаг read-only для самого юзера,
// но виден в access-проверках через JWT-claim.
export const isDemo = (user: ({ demo?: boolean | null } & Roleish) | null | undefined): boolean =>
  Boolean(user?.demo)

// Полный owner-доступ (сетевой, без скоупа филиалом) — только у живого владельца.
// Демо-owner формально имеет roles: ['owner'], но в access-решениях должен вести
// себя как филиальный админ своего демо-филиала (см. adminBranchId ниже), иначе
// демо-тур получает доступ ко всей сети. UI-роутинг (какой дашборд открыть)
// остаётся на isOwner — это только про write/read-authz.
export const isFullOwner = (
  user: ({ demo?: boolean | null } & Roleish) | null | undefined,
): boolean => isOwner(user) && !isDemo(user)

// Модерация входа (M5 PR-B): самореги ждут подтверждения владельцем/админом.
// Пропущенный статус = approved: JWT-сессии, выписанные ДО ввода поля, статуса
// не несут — fail-closed здесь запер бы всех действующих пользователей.
export const isPending = (user: ({ status?: string | null } & Roleish) | null | undefined): boolean =>
  Boolean(user) && user!.status === 'pending'
export const isAdmin = (user: Roleish): boolean => hasRole(user, 'admin')
export const isCoach = (user: Roleish): boolean => hasRole(user, 'coach')
export const isParent = (user: Roleish): boolean => hasRole(user, 'parent')
export const isChild = (user: Roleish): boolean => hasRole(user, 'child')

// Филиал, которым управляет админ: users.branch (id). null — не админ или филиал
// не назначен (админ без филиала не управляет ничем — fail-closed).
export const adminBranchId = (user: Branchish): string | number | null => {
  // Демо-owner/admin (D-029) скоупится своим демо-филиалом, как обычный
  // branch-admin — поверх проверенного M5-скоупинга ниже. Полный
  // сетевой owner-доступ остаётся только у живого владельца (isFullOwner).
  if (isDemo(user) && hasRole(user, 'owner', 'admin') && user?.branch) {
    return typeof user.branch === 'object' ? user.branch.id : user.branch
  }
  if (!isAdmin(user) || !user?.branch) return null
  return typeof user.branch === 'object' ? user.branch.id : user.branch
}

// Field-level: разрешить задавать значение поля только персоналу (owner/admin/coach).
// Если доступа нет — Payload отбрасывает присланное значение и применяет defaultValue.
export const adminOrStaffField: FieldAccess = ({ req: { user } }) =>
  hasRole(user, 'owner', 'admin', 'coach')

// Field-level: менять может только ЖИВОЙ owner (напр. SSO-привязка, users.demo —
// защита от самоперепривязки чужого sub; до M5 гейт назывался adminField).
// isFullOwner, не isOwner: демо-owner формально имеет roles: ['owner'], но не
// должен уметь снять с себя собственный demo-флаг (эскалация до полного owner)
// или переписать себе authProvider/externalId/login (D-029).
export const ownerField: FieldAccess = ({ req: { user } }) => isFullOwner(user as Branchish)

// Field-level гейт назначения ролей (защита от самоповышения):
//   • owner назначает любые роли;
//   • admin — только coach/parent (не owner/admin) и только в своём филиале
//     (сверка branch цели — в rolesWithinAdminBranch ниже, где есть doc/data);
//   • остальные роли менять не могут.
export const rolesField: FieldAccess = ({ req: { user }, data, doc }) => {
  if (isFullOwner(user as Branchish)) return true
  if (!isAdmin(user)) return false
  const proposed: unknown = data?.roles
  if (Array.isArray(proposed) && proposed.some((r) => r === 'owner' || r === 'admin')) return false
  // Цель — юзер того же филиала (на create сверяем присланный branch).
  const branch = adminBranchId(user as Branchish)
  if (branch == null) return false
  const targetBranch = (doc ?? data)?.branch
  const targetId =
    typeof targetBranch === 'object' && targetBranch !== null ? targetBranch.id : targetBranch
  return targetId != null && String(targetId) === String(branch)
}

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

// ID групп филиала — скоуп филиального админа (M5). Служебный find, overrideAccess (G90).
export const branchGroupIds = async (
  req: PayloadRequest,
  branchId: string | number,
): Promise<(string | number)[]> => {
  const res = await req.payload.find({
    collection: 'groups',
    where: { branch: { equals: branchId } },
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

// Текущая группа ребёнка берётся через player.account. При переводе тренером
// меняется player.group — старый скоуп исчезает на следующем запросе автоматически.
export const childGroupIds = async (
  req: PayloadRequest,
  userId: string | number,
): Promise<(string | number)[]> => {
  const res = await req.payload.find({
    collection: 'players',
    where: { account: { equals: userId } },
    depth: 0,
    limit: 1,
    pagination: false,
    overrideAccess: true,
  })
  const group = res.docs[0]?.group
  const id = typeof group === 'object' && group !== null ? group.id : group
  return typeof id === 'number' ? [id] : []
}

// ID тренировок групп филиала — скоуп филиального админа для session-привязанных
// коллекций (Notifications, Rsvps). Та же плоская схема, что coachSessionIds.
export const branchSessionIds = async (
  req: PayloadRequest,
  branchId: string | number,
): Promise<(string | number)[]> => {
  const groupIds = await branchGroupIds(req, branchId)
  if (!groupIds.length) return []
  const res = await req.payload.find({
    collection: 'training-sessions',
    where: { group: { in: groupIds } },
    depth: 0,
    limit: 10000,
    pagination: false,
    overrideAccess: true,
  })
  return res.docs.map((doc) => doc.id)
}

// ID тренировок групп, где данный пользователь — тренер. Нужен для scoped-read
// производных коллекций M2 (Notifications, Rsvps), которые привязаны к session, а
// не к group напрямую. Возвращаем плоский список session-id → access-фильтр
// `{ session: { in: [...] } }` (НЕ вложенный relationship-where `session.group` —
// тот заставил бы Payload джойнить training-sessions и применять их async-access,
// риск рекурсии/протечки; критик M2 H2). Служебный find — overrideAccess (G90).
export const coachSessionIds = async (
  req: PayloadRequest,
  userId: string | number,
): Promise<(string | number)[]> => {
  const groupIds = await coachGroupIds(req, userId)
  if (!groupIds.length) return []
  const res = await req.payload.find({
    collection: 'training-sessions',
    where: { group: { in: groupIds } },
    depth: 0,
    limit: 10000,
    pagination: false,
    overrideAccess: true,
  })
  return res.docs.map((doc) => doc.id)
}
