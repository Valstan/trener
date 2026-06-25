# trener — Session Handoff

> Sticky-note для непрерывности сессий. Перезаписывается `/close_session`. История через `git log -- docs/SESSION_HANDOFF.md`.

**Status:** ACTIVE
**Updated:** 2026-06-25 (M2 стартовал: хостинг решён=Бокс 1, M2 спроектирован, PR4 модель ядра смержена + верифицирована на живой БД, локальная dev-БД поднята)
**Branch:** main

## Текущая нитка

**M2 «Ядро» (изменение→ack→coverage + RSVP + пуш) — стройка идёт.** Спроектировано multi-agent-разведкой (5 читателей → дизайн → критик: 4 CRITICAL учтены). Полный блюпринт + нарезка PR4–PR9 + ключевые решения → **[`docs/m2-core-design.md`](m2-core-design.md)** (читать перед PR5).
- **[#17](https://github.com/Valstan/trener/pull/17) — PR4 (модель ядра) смержен.** Коллекции `Notifications`/`Rsvps`/`Devices` + diff-поля `TrainingSessions` + G90-safe access (`coachSessionIds`, `selfByField`). Схема **верифицирована на живом Postgres** (таблицы+колонки+индексы созданы). Гейты зелёные, 32 теста.
- **[#16](https://github.com/Valstan/trener/pull/16)** — хостинг: ack brain, площадка = Бокс 1 (live-замер 3 серверов).

**M1 завершён ранее** (PR1–3, #11–14): каркас + magic-link/invite + PWA + 152-ФЗ статика + incident-playbook. Операционные go-live-шаги (вне репо): уведомление РКН (§5.1), реквизиты оператора (`OPERATOR_FINALIZED`).

## Следующий шаг

**⚠️ ПЕРВЫМ ДЕЛОМ переспросить (просьба владельца 2026-06-25):** как пейсить оставшиеся PR M2 —
1. **In-app кор (PR5→PR7) автономно** [рекоменд.] — вся герой-фича на in-app, чекпоинт перед пушем;
2. весь M2 (PR5→PR9) автономно (вкл. web-push + RSVP/cron);
3. по одному PR с паузой на ревью.

После ответа → **PR5: diff-хук `trackSessionChange` (beforeChange) + фан-аут `fanOutScheduleChange` (afterChange → создаёт Notifications) + `revalidateSchedule`. Без пуша.** Детали и образцы — в [`docs/m2-core-design.md`](m2-core-design.md). Верифицировать на локальной dev-БД (поднята, см. Контекст).

**Хостинг (для M3):** площадка = Бокс 1, ack отправлен (brain заархивирует `prod-hosting-answer`). Провижен изоляции + deploy-smoke #011 = M3.

## Контекст

- **PWA (PR3):** manifest/иконки/sw на публичных путях (G59 — браузер тянет без cookies), manifest в корне `app/` (G12). SW: network-first навигации, cache-first статика; **auth/онбординг (`/auth`,`/login`,`/join`,`/onboarding`) НЕ кэшируются** (152-ФЗ — токены+детские ПДн не оседают в Cache Storage). SW регистрируется только в prod. Иконки перегенерить — `node web/src/scripts/genPwaIcons.ts`.
- **152-ФЗ статика (PR3):** `/privacy` — публичная, без auth, доступна с главной и из формы согласия. Согласие — отдельный акт (оператор/данные/цели/срок + ссылка на политику + право отзыва), чекбокс не предзаполнен. ⚠️ **Перед go-live:** `web/src/lib/operator.ts` — вписать реальные реквизиты + дату уведомления РКН, выставить `OPERATOR_FINALIZED=true` (уберёт черновик-плашку с `/privacy`).
- **⚠️ Авто-мерж — реальность vs мандат:** native GitHub auto-merge в репо **отключён** (`gh pr merge --auto` → «Auto merge is not allowed»), отдельного auto-merge **workflow нет** (только `ci.yml`). «Авто-мерж по зелёному» (#027) де-факто = **сессия мержит зелёный PR вручную** `gh pr merge --squash --delete-branch` (без человеческого ревью — зелёный CI = аппрувер). Чтобы стало hands-off — добавить workflow (`workflow_run` по успеху CI → `gh pr merge --squash`).
- **Каркас `web/`:** Payload 3.75 / Next 15.4 / React 19 / Postgres. Коллекции (после PR4): Users(admin|coach|parent), Groups, Players, TrainingSessions, Consents, LoginTokens, **Devices, Notifications, Rsvps**. authz #015 day-1. Сборка standalone в CI; локальный `next build` — обычный (G17/G20).
- **M2-модель (PR4):** `Notifications` — очередь непринятых+ack (status delivered→seen→acked→superseded, волны через `changedAt`-снимок). `Rsvps` — going/not_going по (session×player). `Devices` — web-push подписки. Все write — server-mediated (эндпоинты+overrideAccess, #015). Полный дизайн → [`docs/m2-core-design.md`](m2-core-design.md).
- **🟢 Локальная dev-БД поднята (06-25, эта машина):** PG17 (служба `postgresql-x64-17`, Manual, пароль `postgres`/`postgres`), БД `trener_dev`, `web/.env` (gitignored). `corepack pnpm -C web dev` → `push:true` материализует схему. **Снимает блокер deploy-smoke локально** (рантайм auth/invite/consent/flow гоняется без прода). На другой машине — воссоздать (см. design-doc §«Локальная dev-среда»). pnpm только через `corepack pnpm`.
- **Решения владельца:** PWA-first (не RN); чат — M4; тренеры правят свои группы; invite-воронка — тренер заводит Player, инвайт линкует родителя.

## Хвосты на потом (не блокеры)

- **✅ Хостинг решён (06-25):** Бокс 1, изоляция per-project. **Провижен на M3** (точь-в-точь вМалмыже/KARMAN): своя БД `trener` + роль `trener_app`, секреты `/etc/trener/trener.env` (#008), `trener.service`, порт предв. **3007** (3002/3004/3005/3006 заняты — свериться на боксе), CI-standalone деплой (G17/G20), TLS certbot. Ёмкость на 06-25: Бокс 1 = 936 МБ available + 2 ГБ swap, 1 vCPU — **вмещает впритык**; триггер на managed-PG: available < ~400 МБ под нагрузкой или 2-я школа.
- **Локальный node_modules:** после pull PR с изменением `web/pnpm-lock.yaml` прогнать `pnpm -C web install` — иначе typecheck падает `Cannot find module` (node_modules отстаёт от lockfile). Также `.next` от смены ветки может оставлять устаревшие типы → `rm -rf web/.next` при ложном TS2307 на `.next/types`.
- **152-ФЗ sequencing:** тренер заводит Player (имя+группа) ДО согласия родителя — уточнить юр-обоснование (ростер школы) в M2.
- **CI дублируется** (push + pull_request → 2 прогона на PR) — можно сузить concurrency/path-filter, не блокер.
- **CI-аннотация:** `pnpm/action-setup@v4` тянет Node20-deprecation warning — не падение.
