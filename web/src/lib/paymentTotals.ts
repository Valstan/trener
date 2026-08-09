// Агрегаты учёта оплат (M8 доводка 09.08). До этого суммирования не было ВООБЩЕ:
// ни итога по ребёнку, ни «собрано за месяц», ни задолженности — владелец видел
// только последнюю запись каждого ребёнка. Чистые функции — юнит-тесты.

import type { SubscriptionStatus } from './subscriptionStatus'

export const monthOf = (iso: string | null | undefined): string | null => {
  if (!iso) return null
  const t = new Date(iso)
  if (Number.isNaN(t.getTime())) return null
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}`
}

export type MonthTotal = { count: number; total: number }

// «Собрано за месяц»: записи, СОЗДАННЫЕ в этом месяце (дата записи ≈ дата платежа —
// деньги через приложение не ходят, отметку ставят в день оплаты).
export const collectedInMonth = (
  subs: { amount?: number | null; createdAt?: string | null }[],
  month: string,
): MonthTotal => {
  let count = 0
  let total = 0
  for (const s of subs) {
    if (monthOf(s.createdAt) !== month) continue
    count++
    total += s.amount ?? 0
  }
  return { count, total }
}

// Сумма всех записей (история ребёнка «за всё время»).
export const sumAmounts = (subs: { amount?: number | null }[]): number =>
  subs.reduce((acc, s) => acc + (s.amount ?? 0), 0)

// Задолженность по текущим статусам: просрочен/нет записи × цена абонемента группы.
// Оценка (не бухгалтерская проводка): цена может быть не задана — такие дети
// считаются в count, но не в total.
export const debtSummary = (
  rows: { status: SubscriptionStatus; fee: number | null }[],
): MonthTotal => {
  let count = 0
  let total = 0
  for (const r of rows) {
    if (r.status !== 'expired' && r.status !== 'none') continue
    count++
    total += r.fee ?? 0
  }
  return { count, total }
}
