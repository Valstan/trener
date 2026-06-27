# trener — Session Handoff

> Sticky-note для непрерывности сессий. Перезаписывается `/close_session`. История через `git log -- docs/SESSION_HANDOFF.md`.

**Status:** ACTIVE
**Updated:** 2026-06-27 (C4 dedup-UNIQUE-индексы сданы в прод по #017-потоку; грабля dev-сентинела `payload migrate` найдена и вылечена. Прод полностью синхронизирован, лага нет.)
**Branch:** main

## Текущая нитка

Сессия закрыла кодовый хвост **C4** (DB-dedup индексы) полным циклом до прода. Всё смержено и проверено вживую:

- **C4 UNIQUE-индексы ([#41](https://github.com/Valstan/trener/pull/41)).** `UNIQUE(session, player)` на rsvps + `UNIQUE(session, parent, changedAt)` на notifications — заданы через `indexes` коллекций, `migrate:create` сгенерил DDL. **Обычный compound-UNIQUE, не partial** (все колонки NOT NULL; partial непредставим в Payload-конфиге → провалил бы верификацию 1:1). Верифицировано: `migrate` на чистой БД + `pg_dump` diff push==migrate **byte-identical**; typecheck/lint/test **75/75**. На проде: миграция `dedup_unique_indexes` batch 2, оба индекса на боксе.
- **Грабля dev-сентинела + фикс ([#42](https://github.com/Valstan/trener/pull/42)).** Поправлен `docs/migrations.md` (ошибочно «сентинел не влияет») + письмо brain (GOTCHAS-кандидат, родня G20). См. «Заметки» ниже.

## Следующий шаг

Кодовый хвост C4 закрыт. Остаются **go-live гейты (действия владельца, вне кода):**
1. **Активировать offsite-бэкапы** (главный гейт): gpg-ключ (приватный — вне бокса!) → `/etc/trener/backup-pubkey.asc`; выбрать хранилище push/pull → `/etc/trener/trener-backup.env` (шаблон `deploy/trener-backup.env.example`); `sudo systemctl enable --now trener-backup.timer` + прогон. Runbook — [`docs/backups.md`](backups.md).
2. **SMTP-relay** в `/etc/trener/trener.env` (сейчас magic-link в консоль → реальный родитель не залогинится).
3. **РКН-уведомление** до приёма реальных ПДн; реквизиты оператора в `web/src/lib/operator.ts` + `OPERATOR_FINALIZED=true`.

**Кодовые хвосты (если возьмёшься вместо гейтов):** каскады delete Player/User (FK `SET NULL` ⨯ `NOT NULL` → beforeDelete-чистка); deprecation `pnpm/action-setup@v4` (косметика).

## ⚠️ Заметки этой сессии (не потерять)

- **Грабля: `payload migrate` (apply) виснет на сентинеле `(dev,-1)`.** Первый реальный накат на прод завис на интерактивном «run in dev mode… proceed? (y/N)» — job убит таймауту (`The operation was canceled`). Это **отдельный** от drizzle-push/G20 промпт самой команды `migrate`, и **`NODE_ENV=production` его НЕ гасит**. Лечение: один раз снести строку `name='dev'` из прод-`payload_migrations` (сделано). Задокументировано в `docs/migrations.md` (блок ⚠️ + «Грабли») и в письме brain.
- **Косметический лаг из прошлого handoff РЕШЁН.** `releases/current` = `b1ead87` = main HEAD. (#41 авто-деплой упал на migration-guard как надо → задеплоен вручную `workflow_dispatch`; #42 docs-merge авто-деплой прошёл успешно, **не** завис на edge → дотянул current до HEAD.)
- **RSVP race edge (задумано, не баг):** UNIQUE на rsvps → при гонке двух одновременных тапов проигравший `create` словит violation → 500; родитель ретраит → попадёт в update-ветку. Это и есть страховка C4. Граничную обработку (catch violation → молча update) можно добавить, но при одном тапе на ребёнка ценность ≈0.
- **Поток миграций (#017) живой и обкатан:** новая схема → `migrate:create` → верификация на чистой БД (diff push==migrate) → PR → `apply-migration.yml --ref <ветка>` → merge (авто-деплой падает на guard) → деплой `workflow_dispatch`. Детали — `docs/migrations.md`.

## Контекст — ПРОД (Бокс 1)

- **Бокс:** myjino VPS `831d0ce99bdf.vps.myjino.ru` (SSH-алиас `GONBA`/`TRENERBOX`, user `valstan`, ключ `~/.ssh/id_ed25519`). trener — **:3007**. **Postgres сервер 16.14** (НЕ 17 — это только dev). Домен `интер.вмалмыже.рф` (punycode `xn--e1afpni.xn--80adkdyec4j.xn--p1ai`).
- **БД `trener`** + роль `trener_app`. `payload_migrations`: `(20260627_055816_baseline, 1)` + `(20260627_140438_dedup_unique_indexes, 2)`. **Сентинел `dev` удалён** (см. заметку выше). `releases/current` = `b1ead87`.
- **systemd:** `trener.service` (:3007) + `trener-rsvp-reminders.timer` (active) + `trener-backup.timer` (disabled, ждёт активации). Юниты в `/etc/systemd/system`, ставятся деплоем идемпотентно; backup-скрипт — `/home/valstan/trener/bin/trener-backup.sh`.
- **Секреты:** `/etc/trener/trener.env` (#008): DATABASE_URL, PAYLOAD_SECRET, NEXT_PUBLIC_* (VAPID public), VAPID_PRIVATE_KEY, CRON_SECRET. **Нет SMTP_*** (go-live). Бэкап-конфиг будет в отдельном `/etc/trener/trener-backup.env`.
- **Деплой:** авто при мерже (`deploy-prod.yml` workflow_run) ИЛИ `workflow_dispatch` (обходит migration-guard). Секрет репо `SSH_PRIVATE_KEY`. Релизы `/home/valstan/trener/releases/<sha>` + симлинк `current`, держим 3.
- **G8-edge (может вернуться):** деплой иногда виснет на Ship — myjino-edge фильтрует IP GitHub-раннера. В эту сессию НЕ воспроизвёлся (оба деплоя прошли). Если зависнет на Ship — ретрай/подождать, либо фикс вручную через SSH с rmz4val (не фильтруется).

## Контекст — DEV (rmz4val, эта машина)

- Профиль: [`docs/machines/rmz4val.md`](machines/README.md). Postgres **17** `postgresql-x64-17` (порт 5432), БД `trener_dev`, pnpm только `corepack pnpm` (10.15). `web/.env` (gitignored). **node v24** → standalone только в CI. gpg на dev есть, но gpg-агент капризен на кастомном GNUPGHOME (MSYS) — backup-roundtrip гонять на боксе.
- Каркас: Payload 3.75 / Next 15.4, 11 коллекций, **75 юнит-тестов** зелёные. Миграции — `web/src/migrations/` (baseline + dedup_unique_indexes). Мержим вручную `gh pr merge --squash --delete-branch` по зелёному CI (#027).

## Хвосты (не блокеры)

- Каскады delete Player/User (FK `SET NULL` ⨯ `NOT NULL`) — beforeDelete-чистка, редкое admin-действие.
- deprecation-warning `pnpm/action-setup@v4` на node20-раннере — косметика.
