# trener — Session Handoff

> Sticky-note для непрерывности сессий. Перезаписывается `/close_session`. История через `git log -- docs/SESSION_HANDOFF.md`.

**Status:** ACTIVE
**Updated:** 2026-07-11 (Сессия «Радар-SSO + хвосты»: построена и выкачена в прод сторона trener для единого входа Малмыжа — 6 PR #55–#60, все в проде. Прод здоров на `478f42c`.)
**Branch:** main

## Текущая нитка

Реализован **единый вход Малмыжа** (Радар-ID, `вход.вмалмыже.рф`) — trener пилот Ф1 экосистемного SSO. Плюс закрыты три кодовых хвоста. Шесть PR смержены и задеплоены:

- **[#55](https://github.com/Valstan/trener/pull/55) вход через Радар-ID (OIDC Code+PKCE).** `lib/auth/oidc.ts` (discovery-кэш, PKCE S256, `jose.jwtVerify` по JWKS, tx-cookie с HMAC), `lib/auth/radarLink.ts` (связывание §3.3 + двойной анти-захват), маршруты `/auth/vk/start|callback`, поля `users.authProvider/externalId` (миграция `20260710_052545`, верифицирована `diff pg_dump == IDENTICAL`, накатана на прод до мержа). Секреты `RADAR_*` в `/etc/trener/trener.env` + зеркало в KARMAN.
- **[#57](https://github.com/Valstan/trener/pull/57) приём приглашения залогиненным.** `linkPlayerToUser` (из `acceptInvite`), `POST /auth/accept-invite-session` (one-click, только parent), `?next=` в OIDC с гардом open-redirect (`sanitizeNextPath`).
- **[#58](https://github.com/Valstan/trener/pull/58) каскады delete Player/User.** beforeDelete-хуки (FK `SET NULL`⨯`NOT NULL`); согласия уходят с аккаунтом (бумага — источник истины, лог).
- **[#59](https://github.com/Valstan/trener/pull/59)** `pnpm/action-setup` v4→v6.
- **[#60](https://github.com/Valstan/trener/pull/60) брендинг единого входа.** Кнопка «Войти через VK» → «Войти через Малмыж» (VK — метод внутри единого входа, не провайдер). Только тексты; роут `/auth/vk/callback` не трогали (зафиксирован в регистрации у Радара).

Тесты 85 → **116**. Письмо-отчёт Мозгу отправлено ([#56](https://github.com/Valstan/trener/pull/56)).

## Следующий шаг

**Живой round-trip Ф1 — за владельцем (одно действие, вне кода):** `интер.вмалмыже.рф/login` → «Войти через Малмыж» → на `вход.вмалмыже.рф` войти через ВКонтакте (App «Войти в Сервисы Малмыжа») → вернётесь в trener на экран по роли. Всё до VK-согласия проверено с прод-бокса (discovery/jwks 200, кнопка редиректит на `вход.вмалмыже.рф`). Как пройдёт — пинг Мозга «round-trip Ф1 закрыт» → setka подключает GONBA/Sabantuy тем же образцом.

Дальше — развилка владельца:
- **go-live — остался ОДИН гейт (вне кода):** РКН-уведомление + реквизиты оператора в `web/src/lib/operator.ts` + `OPERATOR_FINALIZED=true` (сейчас `false`). Технические гейты сняты.
- **Функции из дорожной карты:** двусторонний **чат** (M4); **результаты матчей** (коллекция Matches); **создание расписания тренером** во фронте; ⚠️ фото/видео-галереи (детские медиа — юридически тяжёлое).

## ⚠️ Заметки этой сессии (не потерять)

- **Единый вход уже архитектурно единый:** trener говорит OIDC с `вход.вмалмыже.рф` (Радар-ID), НЕ с VK напрямую. VK — upstream-метод внутри Радара (пока единственный живой; magic-link/Telegram — Ф2/Ф3). Роут `/auth/vk/*` — внутреннее имя, зафиксировано в регистрации клиента (redirect_uri символ-в-символ), **переименовывать нельзя**.
- **client_secret Радара** для клиента `trener` — на боксе setka `/etc/setka/trener-oidc-credentials.txt` (root); в проде trener — в `/etc/trener/trener.env` + KARMAN. Локально (rmz4val) — в `web/.env` (gitignored).
- **Грабля rmz4val:** с этой машины :443 к `вход.вмалмыже.рф`/боксам перемежающе таймаутится (myjino-edge фильтрация IP) → dev VK-вход падает в `/login?error=vk`, хотя код верен. Проверять SSO — с прод-бокса по SSH (discovery/jwks/redirect), не с rmz4val.
- **knip локально OOM'ится** (`oxc-parser` ArrayBuffer, память машины) — гейт `deadcode` держим на CI, локально не блокирующий.
- **Мерж-очередь:** три быстрых `--squash` подряд отменяют CI друг друга на main (concurrency) — задеплоился финальный коммит со всем содержимым. Не баг, но если нужен деплой конкретного среднего коммита — мержить по одному.

## Контекст — ПРОД (Бокс 1)

- **Бокс:** myjino VPS `831d0ce99bdf.vps.myjino.ru` (SSH-алиас `GONBA`/`TRENERBOX`, user `valstan`, passwordless sudo). trener — **:3007**; KARMAN — **:3002**. **Postgres 16.14**. Домен `интер.вмалмыже.рф` (punycode `xn--e1afpni.xn--80adkdyec4j.xn--p1ai`).
- **БД `trener`** + роль `trener_app`. `payload_migrations`: `baseline`(1) + `dedup_unique_indexes`(2) + **`radar_sso_identity`(3)**. `releases/current` = `478f42c` (= main HEAD).
- **`/etc/trener/`** (#008): `trener.env` (+ `RADAR_ISSUER_URL`/`RADAR_CLIENT_ID`/`RADAR_CLIENT_SECRET`, всего 17 ключей) · `secrets-token.env` (KARMAN, отдельно) · `trener-backup.env` · `backup-pubkey.asc`. Зеркало 17 ключей + 3 `BACKUP_GPG_*` в KARMAN.
- **Единый вход:** issuer `вход.вмалмыже.рф` (punycode `xn--b1ae3a1a.xn--80adkdyec4j.xn--p1ai`) — модуль Радар-ID проекта setka (`../setka`, ADR-0002). Клиент `trener` зарегистрирован (confidential). Контракт — `docs/auth-sso-vk.md` (статус: РЕАЛИЗОВАНО).
- **Деплой:** авто при мерже (`deploy-prod.yml` workflow_run после CI) ИЛИ `workflow_dispatch`. Схемные правки — поток #017 (`docs/migrations.md`): миграция на ветке ДО мержа → мерж → ручной deploy.

## Контекст — DEV (rmz4val, эта машина)

- Профиль: [`docs/machines/rmz4val.md`](machines/README.md). Postgres **17** `postgresql-x64-17` (порт 5432; `Start-Service`, иногда со 2-го раза — в эту сессию сервис был Stopped, поднимал вручную), БД `trener_dev`, pnpm только `corepack pnpm`. `web/.env` (gitignored, с `RADAR_*` для dev). **node v24**.
- **Грабля cwd Bash-тула:** рабочая директория «залипает»; использовать `corepack pnpm -C web …`.
- Каркас: Payload 3.75 / Next 15.4, **jose 5.9.6** (прямая зависимость для OIDC), 11 коллекций, **116 юнит-тестов**. Мержим вручную `gh pr merge --squash --delete-branch` по зелёному CI. Гейты CI: lint/typecheck/test/knip/build.
- **Сид demo-данных:** `corepack pnpm -C web seed` — наполнить пустую `trener_dev`; печатает свежие magic-link.
- **Верификация миграции** (перед PR): раздел «Верификация» в `docs/migrations.md` — diff pg_dump dev-push vs migrate-сборки == IDENTICAL.

## Хвосты (не блокеры)

- ✅ invite-флоу под VK (#57), каскады delete (#58), action-setup бамп (#59), брендинг единого входа (#60) — СДЕЛАНЫ.
- Открытых кодовых хвостов нет. Следующее — по развилке владельца (go-live-гейт / функции дорожной карты).
