import { cookies } from 'next/headers'

// Контекст филиала владельца (M5 PR-D, docs/m5-design.md §6): владелец видит все
// филиалы, но coach-экраны удобнее смотреть «в контексте» одного. Выбор живёт в
// httpOnly-cookie: не ПДн, переживает переходы, не требует клиентского состояния.
// Отсутствие cookie / мусор = «все филиалы» (без фильтра). Только UX-фильтр
// владельца — authz-скоупинг ролей от него НЕ зависит.
export const BRANCH_CTX_COOKIE = 'branch_ctx'

export const readBranchCtx = async (): Promise<number | null> => {
  const raw = (await cookies()).get(BRANCH_CTX_COOKIE)?.value
  if (!raw) return null
  const id = Number(raw)
  return Number.isInteger(id) && id > 0 ? id : null
}
