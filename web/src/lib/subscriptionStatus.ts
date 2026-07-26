// Статус абонемента по дате «оплачено по» (M8). В БД не хранится — вычисляется,
// нечему протухать. Порог «заканчивается» — 7 дней (напоминание заранее).
export type SubscriptionStatus = 'active' | 'expiring' | 'expired' | 'none'

export const SOON_DAYS = 7

export const subscriptionStatus = (paidUntil: string | null | undefined, now: Date): SubscriptionStatus => {
  if (!paidUntil) return 'none'
  const until = new Date(paidUntil)
  if (Number.isNaN(until.getTime())) return 'none'
  // Абонемент действует ВЕСЬ день «оплачено по» включительно.
  const end = new Date(until)
  end.setHours(23, 59, 59, 999)
  if (end.getTime() < now.getTime()) return 'expired'
  const soon = new Date(now)
  soon.setDate(soon.getDate() + SOON_DAYS)
  return end.getTime() <= soon.getTime() ? 'expiring' : 'active'
}

export const STATUS_VIEW: Record<SubscriptionStatus, { label: string; cls: string }> = {
  active: { label: 'Оплачен', cls: 'badge badge-ok' },
  expiring: { label: 'Заканчивается', cls: 'badge badge-warn' },
  expired: { label: 'Просрочен', cls: 'badge badge-danger' },
  none: { label: 'Нет записи', cls: 'badge' },
}
