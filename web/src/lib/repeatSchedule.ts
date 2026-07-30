// Разворот «повторять по дням недели до даты» в список занятий (п.2 аудита 30.07:
// расписание вбивалось по одной тренировке — 6 групп × 2 раза в неделю ≈ 50 ручных
// вводов в месяц).
//
// ⚠️ Считается на КЛИЕНТЕ, в его локальной зоне, и уже развёрнутым списком уходит на
// сервер. Причина: «вторник 18:00» — это вторник по местному времени тренера, а у
// сервера его пояса нет. В UTC поздний вечер MSK уезжает на соседний день, и раскладка
// по дням недели поехала бы вместе с ним.

/** Предохранитель от опечатки в дате «по»: ~полгода при двух тренировках в неделю. */
export const MAX_OCCURRENCES = 120

export type Occurrence = { startDate: string; endDate?: string }

export type WeeklyRepeat = {
  /** Первое занятие: задаёт время суток и начало диапазона. */
  start: Date
  /** Окончание первого занятия — из него берётся длительность для всех повторов. */
  end?: Date | null
  /** Дни недели в нумерации Date.getDay(): 0 = вс … 6 = сб. Пусто = без повторов. */
  weekdays: number[]
  /** Последний день диапазона, включительно (время игнорируется). */
  until: Date
}

const DAY_MS = 24 * 60 * 60 * 1000

/**
 * Возвращает занятия в хронологическом порядке, включая первое.
 *
 * Пустой `weekdays` → ровно одно занятие (обычный «добавить тренировку»).
 * Иначе день недели решает всё: тренер выбрал понедельник, а отметил вт+чт — будут
 * только вторники и четверги. Первое занятие раньше `start` не появится, даже если
 * его день недели отмечен, а `until` раньше `start` даёт пустой список (форма это
 * ловит раньше и сообщает по-человечески).
 */
export const expandWeekly = ({ start, end, weekdays, until }: WeeklyRepeat): Occurrence[] => {
  const startMs = start.getTime()
  if (Number.isNaN(startMs)) return []
  const durationMs = end && !Number.isNaN(end.getTime()) ? end.getTime() - startMs : 0

  const iso = (d: Date): Occurrence =>
    durationMs > 0
      ? { startDate: d.toISOString(), endDate: new Date(d.getTime() + durationMs).toISOString() }
      : { startDate: d.toISOString() }

  const days = weekdays.filter((d) => Number.isInteger(d) && d >= 0 && d <= 6)
  if (days.length === 0) return [iso(start)]

  // Граница — конец дня `until` по местному времени: занятие в 18:00 последнего дня
  // должно попасть в список.
  const limit = new Date(until)
  if (Number.isNaN(limit.getTime())) return []
  limit.setHours(23, 59, 59, 999)

  const out: Occurrence[] = []
  const cursor = new Date(start)
  while (cursor.getTime() <= limit.getTime() && out.length < MAX_OCCURRENCES) {
    if (days.includes(cursor.getDay())) out.push(iso(cursor))
    // Шаг ровно в сутки: переход на летнее время в РФ не действует с 2014 года,
    // поэтому арифметика по миллисекундам здесь безопаснее setDate (нет скачков
    // 31-е → 1-е при переполнении месяца).
    cursor.setTime(cursor.getTime() + DAY_MS)
  }
  return out
}

/** Подпись под формой: «12 тренировок, пн и ср, по 30 сентября». */
export const WEEKDAY_LABELS: { value: number; short: string }[] = [
  { value: 1, short: 'пн' },
  { value: 2, short: 'вт' },
  { value: 3, short: 'ср' },
  { value: 4, short: 'чт' },
  { value: 5, short: 'пт' },
  { value: 6, short: 'сб' },
  { value: 0, short: 'вс' },
]
