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
// Ссылка — на расписание с RSVP-кнопками: раньше вела на /parent, где ответить
// было НЕЧЕМ (кнопки жили только в карточке уведомления об изменении) — пуш звал
// сделать невозможное.
export const buildRsvpReminderMessage = (): PushMessage => ({
  title: 'Скоро тренировка',
  body: 'Подтвердите в приложении, придёт ли ребёнок.',
  url: '/parent/schedule',
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

// Заявки на вступление (#115 доводка). Все — без ПДн (R4): только зов открыть экран.
// Новая заявка — владельцу (инбокс /coach/requests).
export const buildRegistrationSubmittedMessage = (): PushMessage => ({
  title: 'Новая заявка на вступление',
  body: 'Откройте приложение — кто-то ждёт подтверждения.',
  url: '/coach/requests',
  tag: 'trener-registration',
  urgency: 'normal',
})

// Заявка ребёнка передана родителю — подтвердить в «Аккаунте».
export const buildRegistrationParentReviewMessage = (): PushMessage => ({
  title: 'Подтвердите ребёнка',
  body: 'Вам передана заявка — откройте раздел «Аккаунт».',
  url: '/account',
  tag: 'trener-registration',
  urgency: 'normal',
})

// Решение по заявке — самому ребёнку (best-effort: устройств у него может не быть).
export const buildRegistrationDecidedMessage = (kind: 'accepted' | 'rejected'): PushMessage => ({
  title: kind === 'accepted' ? 'Заявка подтверждена' : 'Заявка отклонена',
  body:
    kind === 'accepted'
      ? 'Родитель подтвердил вас — откройте приложение.'
      : 'Откройте приложение: данные можно поправить и подать заявку снова.',
  url: '/',
  tag: 'trener-registration',
  urgency: 'normal',
})

// Отзыв согласия родителем (D-016) — владельцам: школа обязана отреагировать
// (прекратить обработку / связаться с родителем). Без ПДн (R4).
export const buildConsentWithdrawnMessage = (): PushMessage => ({
  title: 'Отозвано согласие на обработку данных',
  body: 'Родитель отозвал согласие — откройте приложение.',
  url: '/admin',
  tag: 'trener-registration',
  urgency: 'high',
})

// Матчи (доводка 09.08). До этого матчи не порождали НИ ОДНОГО уведомления:
// «когда, во сколько, где» доходило до родителя, только если он сам заглянул в
// приложение. Push-only (без Notification/ack): матч — информационный канал
// поверх ядра M2, ров «приняли N из M» остаётся только у изменений расписания.
// R4: ни соперника, ни счёта в payload — читается из РФ-БД.
export const buildMatchMessage = (kind: 'new' | 'moved' | 'result'): PushMessage => ({
  title: kind === 'new' ? 'Назначен матч' : kind === 'moved' ? 'Матч перенесён' : 'Итог матча',
  body: 'Откройте приложение — подробности в разделе «Матчи».',
  url: '/parent/matches',
  tag: 'trener-match',
  urgency: kind === 'moved' ? 'high' : 'normal',
})

// Новые тренировки в расписании (одна отправка на запрос, даже если тренер завёл
// серию из 20 занятий — иначе пуш на каждое занятие превращается в спам).
export const buildSessionsCreatedMessage = (count: number): PushMessage => ({
  title: count > 1 ? 'Новые тренировки в расписании' : 'Новая тренировка',
  body: 'Откройте приложение — расписание обновилось.',
  url: '/parent/schedule',
  tag: 'trener-schedule-new',
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
