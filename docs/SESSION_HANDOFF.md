# trener — Session Handoff

> Sticky-note для непрерывности сессий. Перезаписывается `/close_session`. История через `git log -- docs/SESSION_HANDOFF.md`.

**Status:** ACTIVE
**Updated:** 2026-06-30 (Сессия «оживить фронт»: исправлена **петля входа** (выкачена в прод и проверена live) + идемпотентный **dev-сид** + зафиксирован контракт **входа через VK/Радар** (запрос в Мозг). Три PR #51/#52/#53 смержены, прод здоров на `8ce82ce`.)
**Branch:** main

## Текущая нитка

Сессия — сделать фронт «осязаемым» (был полный, но dev-БД пустая → везде empty-state) и починить вход. Три PR смержены ([#51](https://github.com/Valstan/trener/pull/51)/[#52](https://github.com/Valstan/trener/pull/52)/[#53](https://github.com/Valstan/trener/pull/53)).

- **Петля входа — ИСПРАВЛЕНА ([#51](https://github.com/Valstan/trener/pull/51)), выкачена в прод.** Был баг (и на проде!): `complete-login` редиректил на `/`, а `/` — статический лендинг с «Войти» → вошедший зацикливался. Фикс: хелпер `web/src/lib/auth/home.ts` (роль→экран), `complete-login` ведёт по роли, лендинг `/` (теперь `force-dynamic`) уводит залогиненного на его экран. +5 тестов (**85/85**). Прод проверен по SSH loopback :3007 (health 200, `current=8ce82ce`).
- **Dev-сид ([#52](https://github.com/Valstan/trener/pull/52)).** `corepack pnpm -C web seed` (`web/src/scripts/seed-dev.ts`) — тренер/родители/2 группы/дети/расписание; через реальные волны changed+cancelled хуки сами рассылают уведомления → наполняются очередь родителя и coverage тренера. Предохранитель на `trener_dev` (не прод), идемпотентно, печатает свежие magic-link для входа без SMTP.
- **Вход через VK/Радар — контракт зафиксирован ([#53](https://github.com/Valstan/trener/pull/53)).** Радар (проект Сарафан) — единый центр авторизации, **в разработке**. Дизайн стороны trener + запрашиваемый контракт — `docs/auth-sso-vk.md`; запрос ушёл в `mailbox/to-brain/`. Решения владельца: **все роли через VK**, magic-link **сосуществует**. Код интеграции — ПОСЛЕ согласования контракта.

## Следующий шаг

Развилка владельца:

**A. Вход через VK/Радар — ждём контракт.** Когда Мозг согласует контракт Радара (см. `docs/auth-sso-vk.md` §4) → реализовать сторону trener одним PR: маршруты `/auth/vk/start`+`/auth/vk/callback`, связывание аккаунта (поля `authProvider`/`externalId` в `users`, схемная правка — #017-поток миграций), кнопка «Войти через VK» на `/login`, адаптация invite-флоу под VK-аккаунты. Привязка родитель→ребёнок остаётся через приглашение.

**B. Доработки UI / новые функции.** Походить по экранам (сервер на :3000, ссылки из сида) и решить, что сыро. Из дорожной карты: двусторонний **чат** (M4); **результаты матчей** (коллекция Matches); **создание расписания тренером** во фронте; ⚠️ **фото/видео-галереи** (детские медиа = чувствительные ПДн, юридически тяжёлое).

**C. go-live — остался ОДИН гейт (действие владельца, вне кода):** РКН-уведомление + реквизиты оператора в `web/src/lib/operator.ts` + `OPERATOR_FINALIZED=true` (сейчас `false`). Технические гейты сняты (бэкапы/KARMAN — прошлая сессия).

**Кодовые хвосты (мелочь):** каскады delete Player/User (FK `SET NULL` ⨯ `NOT NULL` → beforeDelete-чистка); deprecation `pnpm/action-setup@v4` (косметика).

## ⚠️ Заметки этой сессии (не потерять)

- **Фронт был полный, «пусто» = пустая dev-БД.** Лечится `corepack pnpm -C web seed`. Ссылки входа magic-link живут 30 мин — перевыпуск = перезапуск сида (данные не дублируются). Демо-аккаунты: `coach@trener.local`, `parent1..3@trener.local`, `admin@trener.local` / пароль `devpass1234` (только dev).
- **Петля входа была и на проде** — фикс #51 выкачен и проверен. Если всплывёт похожее на других экранах — корень был «post-auth redirect на публичный лендинг»; единый источник теперь `web/src/lib/auth/home.ts`.
- **VK/Радар:** Радар в разработке, контракт согласуется через Мозг (письмо `mailbox/to-brain/2026-06-29-sso-radar-contract-proposal.md`). Мост сессии (`buildAuthCookie`) уже даёт «все роли через VK» без отдельного admin-SSO. НЕ писать код до зелёного контракта (переделка).
- **Грабля: :443 к боксу с rmz4val перемежающе таймаутится** (`000`/`UND_ERR_CONNECT_TIMEOUT`), SSH/:22 работает → myjino-edge фильтрация IP. Прод-смоук делать по SSH к loopback (`curl 127.0.0.1:3007/health`). В профиле машины.
- **Грабля харнесса (Windows):** `web/src/app/(payload)/admin/importMap.js` периодически «модифицируется» пустым CRLF-дифом (живой dev-сервер трогает) — это шум, `git checkout --` до коммита.

## Контекст — ПРОД (Бокс 1)

- **Бокс:** myjino VPS `831d0ce99bdf.vps.myjino.ru` (SSH-алиас `GONBA`/`TRENERBOX`, user `valstan`, ключ `~/.ssh/id_ed25519`, **passwordless sudo** — с rmz4val правим `/etc`, читаем логи/БД через :22). trener — **:3007**; KARMAN — **:3002** (тот же бокс). **Postgres сервер 16.14** (НЕ 17 — это dev). Домен `интер.вмалмыже.рф` (punycode `xn--e1afpni.xn--80adkdyec4j.xn--p1ai`).
- **БД `trener`** + роль `trener_app`. `payload_migrations`: `baseline`(1) + `dedup_unique_indexes`(2). В проде один пользователь — `valstan@valstan.ru` (админ). `releases/current` = `8ce82ce` (= main HEAD).
- **`/etc/trener/`** (#008, root:valstan): `trener.env` (DATABASE_URL, PAYLOAD_SECRET, NEXT_PUBLIC_* VAPID public, VAPID_PRIVATE_KEY, CRON_SECRET, SMTP_* 7шт) · **`secrets-token.env`** (SECRETS_TOKEN KARMAN — ОТДЕЛЬНО) · `trener-backup.env` (конфиг бэкапа) · `backup-pubkey.asc` (public gpg, 0644). Резерв 14 секретов + 3 `BACKUP_GPG_*` — в KARMAN.
- **systemd:** `trener.service` (:3007, EnvironmentFile `trener.env` + `secrets-token.env`) + `trener-rsvp-reminders.timer` (active) + **`trener-backup.timer` (enabled, 03:30 MSK)**. Юниты ставятся деплоем идемпотентно; скрипты — `/home/valstan/trener/bin/` (+ pull-скрипт на rmz4val `~/bin/trener-backup-pull.ps1`).
- **Деплой:** авто при мерже (`deploy-prod.yml` workflow_run после CI) ИЛИ `workflow_dispatch`. Релизы `/home/valstan/trener/releases/<sha>` + симлинк `current`, держим 3. G8-edge (Ship-hang, фильтрация IP раннера) — в эту сессию НЕ воспроизвёлся.

## Контекст — DEV (rmz4val, эта машина)

- Профиль: [`docs/machines/rmz4val.md`](machines/README.md). Postgres **17** `postgresql-x64-17` (порт 5432; `Start-Service`, иногда со 2-го раза), БД `trener_dev`, pnpm только `corepack pnpm` (10.15). `web/.env` (gitignored, теперь с `SECRETS_TOKEN`). **node v24** → standalone только в CI. **gpg-keyring** хранит приватный ключ бэкапов (restore-source, fp `CA8C5062…0FF7F5`).
- **Грабля cwd Bash-тула:** рабочая директория «залипает» между вызовами; `cd web && …` молча падает, если уже в `web`. Использовать `corepack pnpm -C web …`.
- Каркас: Payload 3.75 / Next 15.4, 11 коллекций, **85 юнит-тестов** зелёные. Мержим вручную `gh pr merge --squash --delete-branch` по зелёному CI (#027). Гейты CI: lint/typecheck/test/knip/build.
- **Сид demo-данных:** `corepack pnpm -C web seed` (`src/scripts/seed-dev.ts`) — наполнить пустую `trener_dev` для «пощупать» фронт; печатает свежие magic-link.

## Хвосты (не блокеры)

- Каскады delete Player/User (FK `SET NULL` ⨯ `NOT NULL`) — beforeDelete-чистка, редкое admin-действие.
- deprecation-warning `pnpm/action-setup@v4` на node20-раннере — косметика.
- ✅ Роль-роутинг главной — СДЕЛАН (#51): `/` уводит залогиненного на его экран.
- Письма brain этой сессии в `mailbox/to-brain/`: запрос контракта VK/Радар (`2026-06-29-sso-radar-contract-proposal.md`) + грабля post-auth-redirect (`2026-06-30-magic-link-post-auth-redirect-loop.md`) — brain прочитает со своей стороны.
