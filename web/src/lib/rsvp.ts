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

export type RsvpSummary = { going: number; notGoing: number; noResponse: number; total: number }

// Сводка RSVP по сессии: total = детей в группе; going/notGoing — по ответам;
// noResponse — остаток. Для coverage-экрана тренера.
export const summarizeRsvp = (totalPlayers: number, responses: ('going' | 'not_going')[]): RsvpSummary => {
  const going = responses.filter((r) => r === 'going').length
  const notGoing = responses.filter((r) => r === 'not_going').length
  return { going, notGoing, noResponse: Math.max(0, totalPlayers - going - notGoing), total: totalPlayers }
}
