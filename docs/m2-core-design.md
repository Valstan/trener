# M2 «Ядро» — дизайн-документ и нарезка на PR

> Блюпринт вехи M2 (kickoff §8). Сведён из multi-agent-разведки 2026-06-25 (5 читателей:
> kickoff-ТЗ + фактический каркас + Sabantuy/GONBA → синтез → критик нашёл 4 CRITICAL).
> Источник истины по требованиям — `../brain_matrica/docs/plans/trener-kickoff.md` §4/§6/§7/§8.
> Этот файл — план реализации, по нему пишутся PR5–PR9.

## Принцип M2 (kickoff §6/§8)

Корректность держит **in-app очередь непринятых (Notifications) + coverage-экран тренера**,
НЕ доставка пуша. Пуш — best-effort ускоритель поверх. Отсюда порядок: in-app механика
строится **раньше и независимо** от пуша. Критический путь ценности — **PR5→PR7** = вся
герой-фича (изменение→ack→coverage) работает на in-app без единого пуша.

Flow: изменение тренером → фан-аут Notifications → in-app очередь у родителя → ack →
coverage «N из M» тренеру + RSVP (придём/нет).

## Статус

- ✅ **PR4 (модель)** смержен ([#17](https://github.com/Valstan/trener/pull/17)), схема
  верифицирована на живом Postgres. Коллекции `Notifications`/`Rsvps`/`Devices` +
  diff-поля `TrainingSessions` + access (#015, G90-safe).
- ⏭️ Дальше: PR5 → PR6 → PR7 → PR8 → PR9 (ниже).

---

## Модель данных (PR4 — сделано)

### TrainingSessions (+поля, заполнит хук в PR5)
`changedFields` (json), `changedAt` (date, index), `prevStartDate` (date), `prevLocation` (text).
Все — `admin.readOnly`, **read field-locked на staff** (`adminOrStaffField`): родителю diff
отдаёт inbox-эндпоинт готовым текстом (152-ФЗ минимизация). **versions НЕ включаем** (R6 —
расписание «живое», versioned тянет G7/G25/G35; снимок «было» — явными `prev*`-полями).

### Notifications (`notifications`) — ядро корректности
Поля: `session`, `parent`, `players` (hasMany!), `type` (changed|cancelled), `status`
(delivered→seen→acked→**superseded**), `changedAt` (снимок волны), `pushSentAt`/`pushResult`,
`seenAt`/`ackedAt`.
- **status — собственный**, не флаг провайдера. `acked` питает coverage «N из M».
- **Волны (C2):** `changedAt` = снимок `session.changedAt` на момент создания. Новая правка →
  новая волна; старые непринятые → `superseded`. Coverage сверяет
  `notification.changedAt == session.changedAt` (иначе ack старой правки засчитался бы за новую).
- **Гранулярность (H4):** одно уведомление = на (session × parent) за волну; `players` hasMany —
  какие дети родителя затронуты (семья с двумя детьми акает один раз).
- Access: `create` server-only (фан-аут, overrideAccess); `read` scoped (родитель — свои,
  тренер — `{session:{in: coachSessionIds}}`); `update`/`delete` adminOnly (ack — через эндпоинт).

### Rsvps (`rsvps`)
Поля: `session`, `player`, `parent`, `response` (going|not_going), `respondedAt`.
По (session × player), отдельно от ack. Уникальность — endpoint-upsert (PR9) + DB partial-unique
index на M3 (C4). Access: read scoped; write server-only через эндпоинт.

### Devices (`devices`)
Web-push подписки: `user`, `endpoint` (unique), `p256dh`, `auth`, `platform`, `userAgent`,
`lastSuccessAt`, `failureCount`. Access: read/delete свой `user` (`selfByUser`); create/update
server-only. 152-ФЗ: ключи/endpoint — адрес доставки, не ПДн; наружу только непрозрачный токен.

### Access-хелперы (PR4)
- `coachSessionIds(req, userId)` — G90-safe, плоский session-scope (НЕ вложенный
  relationship-where `session.group` — критик H2: тот джойнит training-sessions и применяет их
  async-access → риск рекурсии/протечки). `overrideAccess:true, depth:0`.
- `selfByField`/`selfByUser`/`selfByParent` (`access/scoped.ts`) — скоуп по relationship-полю,
  НЕ `adminOrSelf` (тот по id записи — критик M7).

---

## Нарезка на PR (каждый зелёный, верифицируется на локальной БД)

| PR | Что | Граница | Размер |
|---|---|---|---|
| **PR4** ✅ | Модель: 3 коллекции + поля + access + типы | без хуков/UI/пуша | L |
| **PR5** | `trackSessionChange` (beforeChange diff) + `fanOutScheduleChange` (afterChange → создаёт Notifications) + `revalidateSchedule` | **без пуша** | M |
| **PR6** | In-app очередь + ack: `GET /api/notifications/inbox`, `POST /api/notifications/ack`, UI `/parent` (бейдж + подсветка + «Вижу») | без пуша/RSVP/coverage | M |
| **PR7** | Coverage «N из M»: `GET /api/coverage?sessionId`, UI `/coach/session/[id]` + `/coach/schedule` | герой-фича на in-app | M |
| **PR8** | web-push: `web-push`+VAPID, `Devices` subscribe/unsubscribe, `lib/push/send.ts`, SW-листенеры (push/notificationclick/pushsubscriptionchange), подписка по жесту + iOS standalone-гард, вшить send в фан-аут | реальная доставка iOS/Android — только HTTPS (M3) | L |
| **PR9** | RSVP-кнопки (1 тап) + cron-напоминание **только нереспондентам** (`/api/cron/rsvp-reminders`, секрет-гард) + RSVP-сводка на coverage | — | M |

## Ключевые решения (учтённые находки критика)

- **C1** — diff на ЧАСТИЧНОМ патче: `data.X !== undefined && data.X !== originalDoc.X` для
  каждого критичного поля (`startDate,endDate,location,status`). `prev* = originalDoc.*`.
  НЕ копипаста с Sabantuy — логика тонкая, нужен тест на частичный `payload.update`.
- **C2** — волны через `Notifications.changedAt`-снимок (см. выше).
- **C3** — каскады: `afterDelete`-хуки чистят осиротевшие Notifications/Rsvps/Devices при
  удалении session/player/user. Или явно «сессии только cancelled, не delete». Решить в PR5.
- **C4** — гонки: endpoint-upsert сейчас + DB partial-unique `(session,player)` на Rsvps и
  dedup `(session,parent,changedAt)` на фан-аут (миграция M3).
- **H1/H2** — `coachSessionIds` (плоский session-in), не вложенный where.
- **H3** — **ack-эскалация (родитель не открыл и не подписан) — ВНЕ M2**: закрывает
  coverage-экран (тренер сам звонит). Cron PR9 шлёт только RSVP-нереспондентам. Зафиксировать.
- **H4** — уведомление на семью, `players` hasMany; coverage по родителям (DISTINCT parent).
- **H5** — допущение M2: **1 ребёнок = 1 группа** (`Players.group` single rel + политика §2
  «его группа» ед.ч.). Если всплывёт мульти-группа — меняет модель.
- **M8** — переход статуса «только вперёд» (delivered/seen→acked) — стережёт **эндпоинт ack**
  (PR6): проверяет владение + текущий статус, затем overrideAccess-update. Не field-access.

## Развилки (решены)

- **R1 пуш-либа:** `web-push` npm + 1 VAPID-пара (iOS+Android одним кодом, без Firebase SDK;
  kickoff §2 «legacy FCM мёртв»). Firebase НЕ добавлять.
- **R4 152-ФЗ payload пуша:** НИКАКИХ ПДн ребёнка (имя/группа/контакт) — только
  неидентифицирующий текст + `data.url` на нейтральный `/parent/inbox` (M1: не `/session/<id>` —
  даже id псевдо-идентификатор). Клиент дотягивает из РФ-БД. Unit-тест на сериализацию (PR8).
- **R5 retry:** best-effort = синхронный вызов в afterChange с try/catch (паттерн
  Sabantuy `notifyOrganizer.ts`), без durable-очереди. Payload `jobs`-плагин НЕ вводим.
- **R11 согласие:** ✅ **покрыто** — политика `/privacy` §3 («ведение расписания и
  информирование об изменениях», «отправка уведомлений и сбор подтверждений») + §6 (push через
  Apple/Google с непрозрачным токеном). Пере-согласие НЕ нужно. Версия `2026-06-24`.

## Образцы для копирования (другие репо)
- `SabantuyMalmyzh/web/src/hooks/notifyOrganizer.ts` — best-effort notify в afterChange (try/catch).
- `SabantuyMalmyzh/web/src/hooks/enforceRegistrationOpen.ts` — server-gate в beforeChange.
- `SabantuyMalmyzh/web/src/lib/safeRevalidate.ts` + `revalidateEvent.ts` — on-demand ISR.
- `SabantuyMalmyzh/web/src/app/(frontend)/events/[slug]/RegistrationForm.tsx` — status-машина формы (idle→submitting→success).
- `Gonba/web/src/app/api/projects/[slug]/chat/route.ts` — эталон server-mutation route-handler.
- **Прочитать ПЕРЕД PR6/PR8:** `web/public/sw.js` (текущий VERSION + fetch-listener, чтобы push не сломал офлайн-кэш), `ServiceWorkerRegister.tsx`/`InstallPrompt.tsx` (сигнатуры `isStandalone()`/`isIos()` — экспортируемы ли).

## Локальная dev-среда (на этой машине, 2026-06-25)
- PostgreSQL 17 установлен (`C:\Program Files\PostgreSQL\17\`), служба **`postgresql-x64-17`**
  (Manual). Пароль суперюзера `postgres` = `postgres` (= конвенция CI).
- БД `trener_dev` создана; `web/.env` прописан (gitignored, #008): `DATABASE_URL`,
  `PAYLOAD_SECRET` (dev), `NEXT_PUBLIC_SERVER_URL`. Схема материализуется `push:true` при `pnpm dev`.
- **На другой машине:** поднять PG, создать `trener_dev`, скопировать `web/.env.example`→`web/.env`
  с локальными кредами, `corepack pnpm -C web dev` (push создаст схему).
- pnpm — через `corepack pnpm` (в PATH голого `pnpm` нет).

## Кандидаты в brain (pool #009) — ПОЗЖЕ, не сейчас
- web-push «1 VAPID покрывает iOS+Android без FCM SDK» + iOS-граблы (standalone-гард, user-gesture,
  протухание/dead-letter, 152-ФЗ payload) — **по факту реализации PR8** (push в библиотеке brain
  ещё нет — пионер).
- Уточнение G90: «scoped-read коллекции A по relationship к access-gated B → плоский id-list через
  overrideAccess find + `{B:{in:ids}}`, не вложенный where `B.field`» — **после прогона coach-read
  на реальных данных в PR7** (подтвердить, что не рекурсит).
