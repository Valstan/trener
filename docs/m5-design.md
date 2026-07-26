# M5 — филиалы + роль «владелец»: дизайн

> Веха M5 из [плана v2](plans/2026-07-26-multibranch-vision.md). Статус: **дизайн
> утверждается**. Реализация — серией PR по этому доку.

## 0. Принцип: филиал входит через группы

Весь существующий authz (#015) уже держится на оси «группа»: тренер видит свои
группы (`groups.coaches`), родитель — группы своих детей (`players.parent→group`),
производные коллекции (sessions/notifications/rsvps/matches/questions) скоупятся
по `group`/`session`. Поэтому:

- **`branch` обязателен только на `groups`** — остальной контент наследует филиал
  через свою группу, БЕЗ добавления branch-колонки в каждую коллекцию.
- Прямая branch-колонка нужна лишь там, где группы нет:
  `users.branch` (принадлежность участника) и `announcements` (общесетевые, §4).

Это минимизирует и миграцию, и площадь ошибок в access-правилах.

## 1. Новая коллекция `branches`

| Поле | Тип | Прим. |
|---|---|---|
| `name` | text, required | «Малмыж», «Самара»… |
| `city` | text | для списков |
| `active` | checkbox, default true | «закрыть филиал» без удаления |

Access: read — любой approved-участник (нужно для списков/переключателя);
create/update/delete — только owner.

## 2. Роли v2

`roles`: `owner | admin | coach | parent` (замена нынешнего `admin`).

| Роль | Скоуп | Может |
|---|---|---|
| **owner** | все филиалы | всё: филиалы, назначение ролей (включая других owner), кросс-филиальные объявления, оплата (owner = и «бухгалтер»). Переключатель текущего филиала в UI. |
| **admin** | свой `users.branch` | управление участниками/группами СВОЕГО филиала (модерация входа, выдача ролей coach/parent, группы). Не может: создавать филиалы, назначать owner/admin. |
| **coach** | свои группы (как сейчас) | расписание, матчи, объявления, чаты своих групп. |
| **parent** | свои дети (как сейчас) | без изменений. |

**Маппинг миграции:** существующие `admin` → `owner` (сегодня admin = владелец
де-факто). Существующие coach/parent → без изменений + `branch` = филиал №1.

Хелперы: `isOwner`, `isBranchAdmin(user, branchId)`; `adminField` (гейт назначения
ролей) расщепляется: роли `owner|admin` назначает только owner; `coach|parent` —
owner или admin своего филиала.

## 3. Модерация входа (`users.status`)

- `users.status: pending | approved`, default `pending`. Существующие юзеры
  миграцией → `approved`.
- Самореги (VK/magic-link без инвайта) создаются `pending` **без роли** — видят
  только главную-карточки, все разделы заблокированы (серверно: access-правила
  контента требуют `approved`; UI показывает «ждёт подтверждения»).
- Инвайт-флоу тренера (существующий) сразу даёт `approved` + roль — приглашение
  и есть подтверждение.
- Approve делает owner или admin филиала: выставляет `status=approved`, роль и
  `branch` одним действием (экран «Заявки» — в админке или фронте, решится в UI-PR).
- Поля `status`/`roles`/`branch` — field-access: сам юзер менять не может.

## 4. Кросс-филиальные объявления (owner)

`announcements` дополняется:
- `scope: group | branch | network` (default `group` — текущее поведение).
- `branches: relationship→branches hasMany` — для `scope=branch` (выборочные
  филиалы; пусто при `network` = все).
- `scope=branch|network` создаёт только owner (field-access + validate).
- Read-scope: как сейчас по группе + «объявления моего филиала/сети».
- Баннер на главной: `pinned: checkbox` — network/branch-объявление с pinned
  показывается плашкой на главной странице филиала.

Фан-аут пуша по сети — по существующему M2-конвейеру, филиал за филиалом
(granularity-правило действует: owner-объявление = осознанный пуш).

## 5. Access-правила: что меняется по коллекциям

| Коллекция | Изменение |
|---|---|
| `groups` | +`branch` (required). Create/update: owner или admin филиала (сейчас — admin). Coach-read — без изменений. |
| `users` | +`branch`, +`status`. Read: owner — все; admin — юзеры своего филиала; остальные — как сейчас (self). |
| `players` | без схемных изменений (филиал — через group). Admin филиала получает права нынешнего admin в границах филиала. |
| `training-sessions`, `matches`, `rsvps`, `notifications`, `questions`, `question-messages`, `consents`, `devices`, `login-tokens` | без схемных изменений. Везде, где сейчас `isAdmin(user) → true`, становится `isOwner → true`, а admin — через фильтр по группам своего филиала (`branchGroupIds(req, branchId)` — новый хелпер рядом с `coachGroupIds`). |
| `announcements` | §4. |

Все новые служебные find'ы — `overrideAccess: true` (G90), фильтры плоскими
списками id, не вложенными relationship-where (критик M2 H2).

## 6. UI

- **Переключатель филиала** (только owner): текущий филиал в httpOnly-cookie
  `branch_ctx`; все coach-экраны у owner работают «в контексте» выбранного филиала.
  Admin/coach/parent переключателя не видят.
- **Экран заявок** (owner/admin): pending-юзеры → approve с ролью и филиалом.
- **Экран филиалов** (owner): CRUD филиалов, назначение admin.
- Главная-карточки и баннеры — веха M7, в M5 не входят.

## 7. Миграция данных (#017)

Одна миграция, batch 6:
1. Таблица `branches`; сид первой записи «Малмыж» (id=1) прямо в миграции
   (не в сид-скрипте — прод сид не гоняет).
2. `groups.branch_id` → backfill = 1 → NOT NULL.
3. `users.branch_id` (nullable — owner без филиала), backfill = 1 для всех,
   кроме owner; `users.status` → backfill `approved`.
4. Роли: `admin` → `owner` (enum-значение добавить, данные переписать, старое
   значение убрать).
5. `announcements.scope` default `group` backfill; `pinned` false.

Прогон по потоку #017: миграция на ветке ДО мержа, `apply-migration.yml --ref`,
затем мерж и ручной deploy.

## 8. Порядок PR

1. **PR-A: схема+роли.** `branches`, поля `users.branch/status`, `groups.branch`,
   роли v2 + хелперы (`isOwner`, `branchGroupIds`), маппинг access-правил
   admin→owner по всем коллекциям, миграция §7. Тесты на новые хелперы и
   не-протечку (admin чужого филиала не видит чужих юзеров/групп).
2. **PR-B: модерация входа.** pending-гейт (серверные access + экран «ждёт
   подтверждения»), экран заявок, инвайт → approved.
3. **PR-C: объявления owner.** scope/branches/pinned + фан-аут + composer owner.
4. **PR-D: UI филиалов.** Переключатель owner, CRUD филиалов, назначение admin.

Каждый PR самодостаточен и деплоится; схемные — только PR-A и PR-C (обе миграции
по #017).

## 9. Вне scope M5

Своя авторизация (M6, до неё — письмо Мозгу об уходе с Радара), главная-карточки
(M7), оплата (M8), комнаты чатов (M9), S3-медиа (M10), роль «ребёнок» (M11).
