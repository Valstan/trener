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

// Объявление тренера (M3-PR10). Best-effort, normal-urgency (granularity §6: не high,
// в отличие от изменений расписания). 152-ФЗ R4: заголовок объявления НЕ кладём в payload
// (он проходит через Apple/Google) — только неидентифицирующий зов открыть приложение;
// текст объявления родитель читает из РФ-БД в ленте. Без ПДн ребёнка.
export const buildAnnouncementMessage = (): PushMessage => ({
  title: 'Новое объявление',
  body: 'Откройте приложение — тренер оставил сообщение.',
  url: '/parent',
})
