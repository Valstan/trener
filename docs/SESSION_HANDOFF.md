# trener — Session Handoff

> Sticky-note для непрерывности сессий. Перезаписывается `/close_session`. История через `git log -- docs/SESSION_HANDOFF.md`.

**Status:** ACTIVE
**Updated:** 2026-06-27 (PR12 прод-миграции + 3 roadmap-хвоста сданы: RSVP-cron таймер, offsite-бэкапы, письма brain. Бэкапы стоят, но ЖДУТ активации владельцем.)
**Branch:** main

## Текущая нитка

Сессия закрыла **главный техдолг PR12** и три не-блокера из прошлого handoff. Всё в проде, проверено вживую:

- **PR12 — Payload-миграции ([#35](https://github.com/Valstan/trener/pull/35)).** Прод-схема ушла с ручного push-через-туннель на формальные миграции. Baseline (полный снимок, сгенерён `migrate:create` без дрейфа, проверен 1:1 vs push). Накат — нативным `payload migrate` из CI по SSH-туннелю (`apply-migration.yml`, единый источник `.ts`, без `.sql`-зеркала — осознанно иначе, чем GONBA/Sabantuy). migration-guard в `deploy-prod.yml`. Прод-реестр засеян (`migrate:status` через туннель: baseline `Ran: Yes`). Runbook — [`docs/migrations.md`](migrations.md).
- **RSVP-cron таймер ([#37](https://github.com/Valstan/trener/pull/37)).** `trener-rsvp-reminders.timer` → oneshot curl `/cron/rsvp-reminders` (x-cron-secret). Daily 09:00 MSK, active. Прогон вхолостую: `ok, sessions=0`. Runbook — [`docs/cron.md`](cron.md).
- **Offsite-бэкапы ([#38](https://github.com/Valstan/trener/pull/38)).** `pg_dump -Fc | gpg --encrypt` потоком → локально + опц. rclone в RF S3 (choice-independent push/pull). Restore-roundtrip проверен на боксе (prod=22→restore=22). **Юниты стоят, таймер DISABLED — ждёт активации.** Runbook — [`docs/backups.md`](backups.md).
- **Письма brain:** [#36](https://github.com/Valstan/trener/pull/36) (петля #017 + single-source migrate), и backup-паттерн + G8-рецидив (this PR).

## Следующий шаг

**Активировать offsite-бэкапы** (go-live гейт, действия владельца — см. [`docs/backups.md`](backups.md)):
1. Сгенерить gpg-ключ; **приватный — у себя (вне бокса!)**, публичный → `/etc/trener/backup-pubkey.asc`.
2. Выбрать хранилище: push (rclone + RF S3) или pull (на свою машину). Создать `/etc/trener/trener-backup.env` (шаблон — `deploy/trener-backup.env.example`).
3. `sudo systemctl enable --now trener-backup.timer`; прогнать `systemctl start trener-backup.service` + проверить.

**Остальные go-live гейты (вне кода):** РКН-уведомление до приёма реальных ПДн; реквизиты оператора в `web/src/lib/operator.ts` + `OPERATOR_FINALIZED=true`; **SMTP-relay** в `/etc/trener/trener.env` (сейчас magic-link в консоль → реальный родитель не залогинится).

## ⚠️ Заметки этой сессии (не потерять)

- **G8-рецидив на ДЕПЛОЙ-раннере:** деплой дважды завис на Ship-шаге — myjino-edge фильтровал IP GitHub-раннера (scp/ssh раннер→бокс не подключался; бокс здоров, `releases/current` не сменился). Timer-фикс ([#39](https://github.com/Valstan/trener/pull/39), только unit-файлы) применил вручную через свой SSH (rmz4val не фильтруется). **Последствие:** `releases/current` = `5d687c1` (#38), а main HEAD = `9d58d45` (#39) — косметический лаг (app-код #38≡#39, разница только в timer-файлах, которые на боксе уже исправлены). **Следующий реальный деплой сверит** `current` к свежему SHA. Если деплой снова виснет на Ship — это edge, ретрай/подождать.
- **Деплой триггерится на ЛЮБОЙ мерж в main** (`deploy-prod.yml` workflow_run после CI). Docs-only мерж тоже запускает деплой (no-op redeploy) — может зависнуть на edge, безвредно.
- **Поток миграций (#017) теперь живой:** новая схема → `migrate:create` → верификация на чистой БД → PR → `apply-migration.yml` на ветке фичи → merge → deploy через workflow_dispatch (guard обходит). Детали — `docs/migrations.md`.

## Контекст — ПРОД (Бокс 1)

- **Бокс:** myjino VPS `831d0ce99bdf.vps.myjino.ru` (SSH-алиас `GONBA`/`TRENERBOX`, user `valstan`, ключ `~/.ssh/id_ed25519`). trener — **:3007**. **Postgres сервер 16.14** (НЕ 17 — это только dev). Домен `интер.вмалмыже.рф` (punycode `xn--e1afpni.xn--80adkdyec4j.xn--p1ai`).
- **БД `trener`** + роль `trener_app`. `payload_migrations`: `(dev,-1)` + `(20260627_055816_baseline, 1)`.
- **systemd:** `trener.service` (:3007) + `trener-rsvp-reminders.timer` (active) + `trener-backup.timer` (disabled, ждёт активации). Юниты в `/etc/systemd/system`, ставятся деплоем идемпотентно; backup-скрипт — `/home/valstan/trener/bin/trener-backup.sh`.
- **Секреты:** `/etc/trener/trener.env` (#008): DATABASE_URL, PAYLOAD_SECRET, NEXT_PUBLIC_* (VAPID public), VAPID_PRIVATE_KEY, CRON_SECRET. **Нет SMTP_*** (go-live). Бэкап-конфиг будет в отдельном `/etc/trener/trener-backup.env`.
- **Деплой:** авто при мерже (`deploy-prod.yml` workflow_run) ИЛИ `workflow_dispatch` (обходит migration-guard). Секрет репо `SSH_PRIVATE_KEY`. Релизы `/home/valstan/trener/releases/<sha>` + симлинк `current`, держим 3.

## Контекст — DEV (rmz4val, эта машина)

- Профиль: [`docs/machines/rmz4val.md`](machines/README.md). Postgres **17** `postgresql-x64-17` (порт 5432), БД `trener_dev`, pnpm только `corepack pnpm` (10.15). `web/.env` (gitignored). **node v24** → standalone только в CI. gpg на dev есть, но gpg-агент капризен на кастомном GNUPGHOME (MSYS) — backup-roundtrip гонять на боксе.
- Каркас: Payload 3.75 / Next 15.4, 11 коллекций, **75 юнит-тестов** зелёные. Миграции — `web/src/migrations/`. Мержим вручную `gh pr merge --squash --delete-branch` по зелёному CI (#027).

## Хвосты (не блокеры)

- DB partial-unique индексы (C4 с M2): `(session,player)` на Rsvps + dedup на фан-ауте — следующей миграцией (#017-потоком).
- Каскады delete Player/User (FK `SET NULL` ⨯ `NOT NULL`) — beforeDelete-чистка, редкое admin-действие.
- deprecation-warning `pnpm/action-setup@v4` на node20-раннере — косметика.
