# trener — Session Handoff

> Sticky-note для непрерывности сессий. Перезаписывается `/close_session`. История через `git log -- docs/SESSION_HANDOFF.md`.

**Status:** ACTIVE
**Updated:** 2026-06-29 (Offsite-бэкапы закрыты + подключён менеджер секретов KARMAN + приватный gpg-ключ бэкапов сохранён в KARMAN. **Все технические гейты go-live сняты** — остаётся только РКН-уведомление, действие владельца вне кода.)
**Branch:** main

## Текущая нитка

Сессия — закрытие последнего технического гейта go-live (offsite-бэкапы) + интеграция с менеджером секретов KARMAN. Три PR смержены ([#47](https://github.com/Valstan/trener/pull/47)/[#48](https://github.com/Valstan/trener/pull/48)/[#49](https://github.com/Valstan/trener/pull/49)), прод здоров.

- **Offsite-бэкапы — LIVE ([#47](https://github.com/Valstan/trener/pull/47)).** PULL→Яндекс.Диск: бокс шифрует дамп gpg (публичный ключ), таймер `trener-backup.timer` **enabled** (03:30 MSK); `rmz4val` по Scheduled Task `trener-backup-pull` (04:30 MSK, S4U) стягивает шифр-дампы в `D:\YandexDisk\Backups\trener\` → клиент Диска уносит в облако. Восстановимость проверена end-to-end (`gpg --decrypt → pg_restore --list`, 293 TOC / 44 таблицы). Переиспользует уже работающий клиент Диска (как MatricaRMZ) → ноль новых S3-аккаунтов.
- **Менеджер секретов KARMAN ([#48](https://github.com/Valstan/trener/pull/48)).** trener — первый клиент KARMAN (тот же бокс, :3002). 14 прод-секретов сохранены в KARMAN; при старте, если локальная копия `/etc/trener/trener.env` потеряна, приложение восстанавливает их (`web/src/instrumentation.ts` → `secretsBootstrap`, GET-on-missing, **happy-path = 0 сети**). Токен — в ОТДЕЛЬНОМ `/etc/trener/secrets-token.env` (вне trener.env, чтобы пережить его потерю). Тесты **80/80**.
- **Приватный gpg-ключ бэкапов → в KARMAN ([#49](https://github.com/Valstan/trener/pull/49)).** По решению владельца ключ (`BACKUP_GPG_PRIVATE_KEY`, целостность сверена sha256) положен в KARMAN как резерв против потери. **Осознанный компромисс** (KARMAN на боксе → при взломе бокса бэкапы расшифровываемы; принято ради защиты от потери ключа). Локальный файл удалён, рабочая копия — в gpg-keyring rmz4val. В KARMAN итого 17 ключей.

## Следующий шаг

Все **технические** гейты go-live сняты. Развилка владельца:

**A. Завершить go-live — остался ОДИН гейт (действие владельца, вне кода):**
- **РКН-уведомление** до приёма реальных ПДн + реквизиты оператора в `web/src/lib/operator.ts` + `OPERATOR_FINALIZED=true` (сейчас `false` → политику как боевую публиковать нельзя).
- ✅ Offsite-бэкапы (#47) + приватный ключ в KARMAN (#49) — сделано. Микро-хвост: раз глазами сверить, что дамп виден на disk.yandex.ru (клиент Диска должен быть онлайн).

**B. Новые функции (дорожная карта владельца, бóльший объём):**
- Двусторонний **чат** родитель↔тренер (сейчас односторонний «вопрос тренеру»; M4).
- **Результаты матчей** — новая коллекция Matches + экраны (вне исходного kickoff).
- **Создание расписания тренером** во фронтенде (сейчас только координатор в админке).
- ⚠️ **Фото/видео-галереи** — детские медиа = чувствительные ПДн (152-ФЗ); отдельное согласие, хранилище медиа, пересмотр минимизации. Юридически самое тяжёлое — осознанно.

**Кодовые хвосты (мелочь):** каскады delete Player/User (FK `SET NULL` ⨯ `NOT NULL` → beforeDelete-чистка); deprecation `pnpm/action-setup@v4` (косметика).

## ⚠️ Заметки этой сессии (не потерять)

- **KARMAN — менеджер секретов, trener первый клиент.** API `https://831d0ce99bdf.vps.myjino.ru/api/secrets` (на боксе loopback `:3002`), Bearer-токен скоупом на проект. Токен на проде — `/etc/trener/secrets-token.env`, локально — `web/.env` (оба gitignored). Полный runbook (ротация/восстановление/пересохранение) — [`docs/secrets-manager.md`](secrets-manager.md). ⚠️ Токен попал и в чат этой сессии (владелец вставил) — при желании ротировать в KARMAN → `/secrets`.
- **Приватный gpg-ключ бэкапов в KARMAN — осознанный компромисс** (см. [`docs/backups.md`](backups.md) §gpg-ключ): KARMAN на том же боксе → бэкапы расшифровываемы при взломе бокса. Принято ради защиты от потери ключа. Усиление, если передумать — запаролить ключ (passphrase вне бокса).
- **Грабля: :443 к боксу с rmz4val перемежающе таймаутится** (`UND_ERR_CONNECT_TIMEOUT` / curl `000`), хотя SSH/:22 работает → myjino-edge фильтрация IP (родня G8). Обход: запрос с самого бокса к loopback `:3002`. В профиле машины.
- **preview_screenshot харнесса виснет** (30s) и на dev, и на проде даже при живом рендере — баг скриншот-бэкенда среды, не код. UI верифицировать через `preview_eval`/`show_widget`.

## Контекст — ПРОД (Бокс 1)

- **Бокс:** myjino VPS `831d0ce99bdf.vps.myjino.ru` (SSH-алиас `GONBA`/`TRENERBOX`, user `valstan`, ключ `~/.ssh/id_ed25519`, **passwordless sudo** — с rmz4val правим `/etc`, читаем логи/БД через :22). trener — **:3007**; KARMAN — **:3002** (тот же бокс). **Postgres сервер 16.14** (НЕ 17 — это dev). Домен `интер.вмалмыже.рф` (punycode `xn--e1afpni.xn--80adkdyec4j.xn--p1ai`).
- **БД `trener`** + роль `trener_app`. `payload_migrations`: `baseline`(1) + `dedup_unique_indexes`(2). В проде один пользователь — `valstan@valstan.ru` (админ). `releases/current` = `24b920b` (= main HEAD).
- **`/etc/trener/`** (#008, root:valstan): `trener.env` (DATABASE_URL, PAYLOAD_SECRET, NEXT_PUBLIC_* VAPID public, VAPID_PRIVATE_KEY, CRON_SECRET, SMTP_* 7шт) · **`secrets-token.env`** (SECRETS_TOKEN KARMAN — ОТДЕЛЬНО) · `trener-backup.env` (конфиг бэкапа) · `backup-pubkey.asc` (public gpg, 0644). Резерв 14 секретов + 3 `BACKUP_GPG_*` — в KARMAN.
- **systemd:** `trener.service` (:3007, EnvironmentFile `trener.env` + `secrets-token.env`) + `trener-rsvp-reminders.timer` (active) + **`trener-backup.timer` (enabled, 03:30 MSK)**. Юниты ставятся деплоем идемпотентно; скрипты — `/home/valstan/trener/bin/` (+ pull-скрипт на rmz4val `~/bin/trener-backup-pull.ps1`).
- **Деплой:** авто при мерже (`deploy-prod.yml` workflow_run после CI) ИЛИ `workflow_dispatch`. Релизы `/home/valstan/trener/releases/<sha>` + симлинк `current`, держим 3. G8-edge (Ship-hang, фильтрация IP раннера) — в эту сессию НЕ воспроизвёлся.

## Контекст — DEV (rmz4val, эта машина)

- Профиль: [`docs/machines/rmz4val.md`](machines/README.md). Postgres **17** `postgresql-x64-17` (порт 5432; `Start-Service`, иногда со 2-го раза), БД `trener_dev`, pnpm только `corepack pnpm` (10.15). `web/.env` (gitignored, теперь с `SECRETS_TOKEN`). **node v24** → standalone только в CI. **gpg-keyring** хранит приватный ключ бэкапов (restore-source, fp `CA8C5062…0FF7F5`).
- **Грабля cwd Bash-тула:** рабочая директория «залипает» между вызовами; `cd web && …` молча падает, если уже в `web`. Использовать `corepack pnpm -C web …`.
- Каркас: Payload 3.75 / Next 15.4, 11 коллекций, **80 юнит-тестов** зелёные. Мержим вручную `gh pr merge --squash --delete-branch` по зелёному CI (#027). Гейты CI: lint/typecheck/test/knip/build.

## Хвосты (не блокеры)

- Каскады delete Player/User (FK `SET NULL` ⨯ `NOT NULL`) — beforeDelete-чистка, редкое admin-действие.
- deprecation-warning `pnpm/action-setup@v4` на node20-раннере — косметика.
- Залогиненный пользователь на `/` видит лендинг, не свой экран (роль-роутинг главной не сделан — требует БД на главной, сейчас она статична).
- Письма brain этой сессии (offsite-backup PULL-паттерн #47, KARMAN client-паттерн #48) ушли в `mailbox/to-brain/` — brain прочитает со своей стороны.
