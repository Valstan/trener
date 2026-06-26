export type PushMessage = { title: string; body: string; url: string }

// 152-ФЗ (R4): НИКАКИХ ПДн ребёнка (имя/группа/контакт) в payload пуша — он проходит
// через Apple/Google. Только неидентифицирующий текст + ссылка на нейтральный /parent
// (не /session/<id> — даже id псевдо-идентификатор). Детали клиент дотянет из РФ-БД
// после открытия. Чистая функция — юнит-тест стережёт, что PII не утекает.
export const buildPushMessage = (type: 'changed' | 'cancelled'): PushMessage => ({
  title: type === 'cancelled' ? 'Тренировка отменена' : 'Изменение в расписании',
  body: 'Откройте приложение и подтвердите, что видите изменение.',
  url: '/parent',
})

// Напоминание RSVP-нереспондентам (cron, PR9). Тоже без ПДн (R4).
export const buildRsvpReminderMessage = (): PushMessage => ({
  title: 'Скоро тренировка',
  body: 'Подтвердите в приложении, придёт ли ребёнок.',
  url: '/parent',
})
