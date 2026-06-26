// Превращает уведомление + поля сессии в ГОТОВЫЙ человекочитаемый текст для inbox
// родителя. Чистая функция (юнит-тестируемая, без payload/БД).
//
// 152-ФЗ (R4): служебные diff-поля сессии (changedFields/prev*) field-locked на
// родителя — он их напрямую не читает. Текст собирается на сервере (с overrideAccess)
// и отдаётся родителю уже готовым. В payload пуша (PR8) этот текст НЕ уходит — там
// только неидентифицирующая заглушка; здесь же authed in-app экран, детали допустимы.

// Время школы — Кировская обл. (МСК). Показываем в Europe/Moscow, а не UTC из БД.
const dtf = new Intl.DateTimeFormat('ru-RU', {
  day: 'numeric',
  month: 'long',
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'Europe/Moscow',
})

export const formatDateTime = (iso?: string | null): string => {
  if (!iso) return ''
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '' : dtf.format(d)
}

export type ChangeInput = {
  type: 'changed' | 'cancelled'
  startDate?: string | null
  location?: string | null
  prevStartDate?: string | null
  prevLocation?: string | null
  changedFields?: string[] | null
}

export type ChangeDescription = { title: string; lines: string[] }

export const describeChange = (i: ChangeInput): ChangeDescription => {
  if (i.type === 'cancelled') {
    const when = formatDateTime(i.startDate)
    return { title: 'Тренировка отменена', lines: [when ? `Отменена тренировка ${when}.` : 'Тренировка отменена.'] }
  }

  const fields = Array.isArray(i.changedFields) ? i.changedFields : []
  const lines: string[] = []
  if (fields.includes('startDate')) {
    lines.push(`Время: ${formatDateTime(i.prevStartDate) || '—'} → ${formatDateTime(i.startDate) || '—'}`)
  }
  if (fields.includes('location')) {
    lines.push(`Место: ${i.prevLocation || '—'} → ${i.location || '—'}`)
  }
  if (lines.length === 0) lines.push('Расписание тренировки изменено.')
  return { title: 'Изменение в расписании', lines }
}
