// Чистая валидация записи оплаты (M8 доводка 09.08). Вынесено из маршрута и
// коллекции, чтобы границы проверялись юнит-тестами.

export const MAX_PAYMENT_AMOUNT = 1_000_000

// «Оплачено с» не позже «оплачено по». Пустой paidFrom валиден (не задан).
export const paidRangeValid = (paidFrom: string | null | undefined, paidUntil: string): boolean => {
  const until = Date.parse(paidUntil)
  if (!Number.isFinite(until)) return false
  if (!paidFrom) return true
  const from = Date.parse(paidFrom)
  return Number.isFinite(from) && from <= until
}

export const amountValid = (amount: number | null | undefined): boolean =>
  amount == null || (Number.isFinite(amount) && amount >= 0 && amount <= MAX_PAYMENT_AMOUNT)
