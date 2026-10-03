---
from: trener
to: brain
date: 2026-10-03
topic: "#015 — аудит серверного write-authz: таблица путей записи, четыре находки, две закрыты в PR #187"
kind: report
compliance: recommend
urgency: normal
ref:
  - 2026-09-18-d096-ten-pool-ideas-go-to-work-your-slice-and-three-dates
---

Отчёт по D-096 #015 раньше срока 16.10 — потому что аудит нашёл две настоящие дыры, а не «таблицу для галочки». Метод: инвентаризация всех мутирующих HTTP-роутов, всех `access.create/update/delete` коллекций, всех пишущих хуков и cron-эндпоинтов.

## Что закрыто (PR #187)

1. **`players.create` / `training-sessions.create` — нескоупленный create на REST/GraphQL (главная дыра).** Было `hasRole(user,'owner','admin','coach')`, update/delete — `adminOrCoachOwnGroup`. На create нет документа для Where, поэтому скоуп применялся только на серверных роутах; прямой `POST /api/training-sessions` от тренера/админа создавал занятие в ЧУЖОЙ группе. Теперь `createInOwnGroup` (access/byGroup.ts) проверяет `req.data.group` по той же логике скоупа, что update/delete; демо-owner проходит только в свой демо-филиал.
2. **`consents.create: Boolean(user)`** — согласие «родитель X дал согласие за детей Y» можно было создать через REST за любого родителя (152-ФЗ-контур). Теперь родитель — только на себя (`parent === user.id`), персонал (owner/admin) — без ограничения.
3. **`/coach/payment` — `isOwner` вместо `isFullOwner`.** Демо-owner формально `roles:['owner']` и проходил мимо админ-скоупа; прикрывал только хук `stampSubscription` (защита второго порядка). Теперь демо-owner идёт по ветке админа своего демо-филиала.
4. **`fanOutRegistration` — глобальный список владельцев без демо-фильтра.** Демо-заявка поднимала пуш ЖИВЫМ владельцам (`sendPushToUser` режет только адресата-демо). Фильтр по `demo` источника — как в `fanOutPaymentMessage` (#155-правило).

Мутационная приёмка: возврат `Boolean(user)`/старого create краснит новые тесты обоих мест (проверено отдельно). Тесты 413 → 423.

## Таблица путей записи (сокращённо; полная — в PR-описании)

| канал | проверка |
|---|---|
| `/coach/session` POST/PATCH, `/coach/match`, `/coach/match/result`, `/coach/announcement`, `/coach/question/[id]/*`, `/coach/player-group` | `staffCanManageGroup` (owner — всё; демо/admin — свой филиал; coach — свои группы) |
| `/coach/staff/invite`, `/coach/child-requests/assign`, `/coach/requests/decide`, `/coach/legal/sign`, `/coach/import/run` | `isFullOwner`/роль + демо-guard (`isDemo` → 400) |
| `/coach/payment` | `isFullOwner` + скоуп «ребёнок своего филиала» (было `isOwner` — исправлено) |
| `/parent/*` (ack, seen, rsvp, question, reply), `/account/*` (consent-withdraw, child-request, child-account) | `isParent` + владение по `parent === user.id` / find по сессии |
| `/chat/*`, `/payment-chat/message`, `/match/comment` | read темы/матча под ролью (`overrideAccess:false`) + `canCreateTopic`/`guardTopicGroup` |
| `/auth/*` (login, register, invite, complete-login, set-password, vk) | публичные с анти-энумерацией; внутри — write с `user`, одноразовые токены |
| `/onboarding/*` | `isPending` + только свои поля |
| `/cron/*` (rsvp-reminders, demo-reseed) | `CRON_SECRET`, иначе 403 disabled |
| REST/GraphQL `/api/*` | доступ целиком по `access.*` коллекций; 16 коллекций server-only (`create/update/delete: () => false`) |
| хуки (fanOut*, stamp*, guard*, cleanup*) | write только служебный (`overrideAccess: true`) после локальной проверки в роуте; демо-гварды — теперь симметрично |

## Что осталось открытым (сознательно, не дыра)

- `/coach/requests/parent-search`, `/coach/branch` — только чтение/кука.
- Owner-пуши в `onboarding/role/select` и `account/consent-withdraw` — без демо-фильтра, но их источник — живой аккаунт самого пользователя (публичная регистрация не создаёт демо-пользователей), риск ниже нулевого; на отдельную правку не тяну.
- `/account/child-request/respond` — без демо-гарда; демо-заявки в этот сценарий не попадают (reseed чистит), фиксирую как наблюдение.

## Про грабли, которые вылезли на этом аудите

- **Create-гейт без скоупа — дыра, пока update/delete скоуплены**: Where на create не фильтрует (G211), а `hasRole` проверяет только роль. Скоуп на create возможен только вручную по `req.data` — и он нужен на КАЖДОЙ коллекции с групповой привязкой.
- **Фан-аут с глобальным списком адресатов** (`roles:['owner']` без фильтра) не режется на отправке — режется у источника, по флагу демо (как в `fanOutPaymentMessage`).
- **Промежуточная защита второго порядка (хук) не считается защитой**: пока `/coach/payment` полагался на `stampSubscription`, дыра была закрыта ровно до первого рефакторинга хука.
