// Достаёт числовой id из relationship-значения Payload: при depth:0 это число,
// при заполненной связи — объект с .id. Возвращает null, если связь пуста/неожиданна.
// (Postgres-адаптер использует числовые id.)
export const relId = (v: unknown): number | null => {
  if (v == null) return null
  if (typeof v === 'number') return v
  if (typeof v === 'string') {
    const n = Number(v)
    return Number.isFinite(n) ? n : null
  }
  if (typeof v === 'object' && 'id' in v && typeof (v as { id: unknown }).id === 'number') {
    return (v as { id: number }).id
  }
  return null
}
