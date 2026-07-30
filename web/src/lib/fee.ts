// Цена абонемента: у группы своя, иначе цена филиала (п.3 аудита 30.07 и §3.4
// видения v2 — «сумма к оплате»). В подписке хранится сумма УЖЕ СДЕЛАННОГО платежа,
// она на вопрос «сколько платить дальше» не отвечает, поэтому цена живёт отдельно —
// в группе/филиале.
//
// 0 — валидная цена (бесплатная группа), поэтому проверяем на null/undefined, а не
// на truthy: `groupFee || branchFee` превратил бы бесплатную группу в платную.

export const feeForGroup = (
  groupFee: number | null | undefined,
  branchFee: number | null | undefined,
): number | null => {
  if (typeof groupFee === 'number' && Number.isFinite(groupFee)) return groupFee
  if (typeof branchFee === 'number' && Number.isFinite(branchFee)) return branchFee
  return null
}

/** «2 500 ₽» — с неразрывным пробелом перед знаком рубля. */
export const formatFee = (fee: number): string => `${fee.toLocaleString('ru-RU')} ₽`
