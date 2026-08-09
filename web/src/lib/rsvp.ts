// RSVP «придёт ли ребёнок» по (session × player). Чистые хелперы (юнит-тест).

export const rsvpKey = (sessionId: number, playerId: number): string => `${sessionId}:${playerId}`

export type PlayerSlot = { sessionId: number; playerId: number; parentId: number | null }

// Кого напоминать (cron): родители детей в предстоящих сессиях, по которым НЕТ RSVP
// за этого ребёнка. H3: только RSVP-нереспонденты (НЕ ack-эскалация — она вне M2,
// её закрывает coverage-экран тренера). Ребёнок без родителя — пропуск (некому слать).
// Дедуп по родителю: один родитель — одно напоминание за прогон.
export const selectReminderParents = (slots: PlayerSlot[], respondedKeys: Set<string>): number[] => {
  const parents = new Set<number>()
  for (const { sessionId, playerId, parentId } of slots) {
    if (parentId == null) continue
    if (respondedKeys.has(rsvpKey(sessionId, playerId))) continue
    parents.add(parentId)
  }
  return [...parents]
}

// Нужно ли сессии cron-напоминание: впереди, в окне 48 ч, не отменена и ещё не
// напоминали. Отметка — одна на сессию (дедуп: ежедневный таймер × окно 48 ч иначе
// шлёт один и тот же пуш дважды). Чистый предикат — фильтр в route дублирует его
// where-клаузой, но границы проверяются здесь, юнит-тестами.
export const REMINDER_WINDOW_MS = 48 * 60 * 60 * 1000

export type ReminderSession = {
  startDate: string
  status?: string | null
  rsvpReminderSentAt?: string | null
}

export const sessionNeedsReminder = (s: ReminderSession, nowMs: number): boolean => {
  if (s.status === 'cancelled') return false
  if (s.rsvpReminderSentAt) return false
  const start = Date.parse(s.startDate)
  if (!Number.isFinite(start)) return false
  return start > nowMs && start - nowMs <= REMINDER_WINDOW_MS
}

export type RsvpSummary = { going: number; notGoing: number; noResponse: number; total: number }

// Сводка RSVP по сессии: total = детей в группе; going/notGoing — по ответам;
// noResponse — остаток. Для coverage-экрана тренера.
export const summarizeRsvp = (totalPlayers: number, responses: ('going' | 'not_going')[]): RsvpSummary => {
  const going = responses.filter((r) => r === 'going').length
  const notGoing = responses.filter((r) => r === 'not_going').length
  return { going, notGoing, noResponse: Math.max(0, totalPlayers - going - notGoing), total: totalPlayers }
}
