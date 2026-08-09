export type PushMessage = {
  title: string
  body: string
  url: string
  // tag системного уведомления: события одного типа схлопываются между собой,
  // но НЕ вытесняют чужой тип (сообщение чата не съест «Тренировка отменена»).
  tag: string
  // Web Push urgency: high — время критично (изменение расписания, kickoff §2),
  // normal — остальное. Проставляется в заголовки отправки (lib/push/send.ts).
  urgency: 'high' | 'normal'
}

// 152-ФЗ (R4): НИКАКИХ ПДн ребёнка (имя/группа/контакт) в payload пуша — он проходит
// через Apple/Google. Только неидентифицирующий текст + ссылка на нейтральный /parent
// (не /session/<id> — даже id псевдо-идентификатор). Детали клиент дотянет из РФ-БД
// после открытия. Чистая функция — юнит-тест стережёт, что PII не утекает.
export const buildPushMessage = (type: 'changed' | 'cancelled'): PushMessage => ({
  title: type === 'cancelled' ? 'Тренировка отменена' : 'Изменение в расписании',
  body: 'Откройте приложение и подтвердите, что видите изменение.',
  url: '/parent',
  tag: 'trener-schedule',
  urgency: 'high',
})

// Напоминание RSVP-нереспондентам (cron, PR9). Тоже без ПДн (R4).
export const buildRsvpReminderMessage = (): PushMessage => ({
  title: 'Скоро тренировка',
  body: 'Подтвердите в приложении, придёт ли ребёнок.',
  url: '/parent',
  tag: 'trener-rsvp',
  urgency: 'normal',
})

// Объявление тренера (M3-PR10). Best-effort, normal-urgency (granularity §6: не high,
// в отличие от изменений расписания). 152-ФЗ R4: заголовок объявления НЕ кладём в payload
// (он проходит через Apple/Google) — только неидентифицирующий зов открыть приложение;
// текст объявления родитель читает из РФ-БД в ленте. Без ПДн ребёнка.
export const buildAnnouncementMessage = (): PushMessage => ({
  title: 'Новое объявление',
  body: 'Откройте приложение — тренер оставил сообщение.',
  url: '/parent',
  tag: 'trener-announcement',
  urgency: 'normal',
})

// Вопрос родителя тренеру (M3-PR11, суррогат чата). Адресат — ТРЕНЕР, ссылка на его
// инбокс /coach/questions. 152-ФЗ R4: текст вопроса и имя родителя НЕ в payload (он
// проходит через Apple/Google) — тренер читает вопрос из РФ-БД. Без ПДн.
export const buildQuestionMessage = (): PushMessage => ({
  title: 'Новый вопрос от родителя',
  body: 'Откройте приложение, чтобы прочитать и ответить.',
  url: '/coach/questions',
  tag: 'trener-question',
  urgency: 'normal',
})

// Ответ тренера в нитке чата (M4). Адресат — РОДИТЕЛЬ, ссылка на его переписку
// /parent/ask (не на нитку по id — id псевдо-идентификатор, R4). Текст ответа и
// имена — НЕ в payload (проходит через Apple/Google); читается из РФ-БД.
export const buildQuestionReplyMessage = (): PushMessage => ({
  title: 'Ответ тренера',
  body: 'Откройте приложение, чтобы прочитать ответ.',
  url: '/parent/ask',
  tag: 'trener-question',
  urgency: 'normal',
})

// Сообщение в теме общей комнаты (M9). Адресат — остальные участники группы.
// 152-ФЗ R4: ни текста сообщения, ни имени автора, ни названия темы в payload —
// он проходит через Apple/Google, а в реплике родителя запросто окажется имя
// ребёнка. Ссылка — на список тем, не на тему по id (id псевдоидентификатор).
export const buildChatMessage = (): PushMessage => ({
  title: 'Новое сообщение в чате',
  body: 'Откройте приложение, чтобы прочитать.',
  url: '/chat',
  tag: 'trener-chat',
  urgency: 'normal',
})
