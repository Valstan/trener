# trener — Session Handoff

> Sticky-note для непрерывности сессий. Перезаписывается `/close_session`. История через `git log -- docs/SESSION_HANDOFF.md`.

**Status:** ACTIVE
**Updated:** 2026-07-16 (Сессия «Расписание во фронте + M4-чат»: 3 PR в проде — #66, #67, #68. Прод здоров на `8ceb8c8`. Машина PC40.)
**Branch:** main

## Текущая нитка

Дорожная карта kickoff §8 **закрыта до M4 включительно**. Выкачено в прод:

- **[#66](https://github.com/Valstan/trener/pull/66) расписание тренером во фронте.** `POST/PATCH /coach/session` + `SessionComposer`/`SessionEditor` на [/coach/schedule](../web/src/app/(frontend)/coach/schedule/page.tsx): создание (planned, не волна), перенос/отмена триггерят ядро M2 (авто-флип статуса, пуш/ack/coverage). `lib/sessionInput` — валидация с C1-семантикой частичного патча.
- **[#67](https://github.com/Valstan/trener/pull/67) M4 двусторонний чат.** Вопрос = голова нитки (данные не мигрировали), новая коллекция `question-messages` (денорм group/parent → плоский read-scope; `author` не-required — FK-грабля NOT NULL ⨯ SET NULL). Reply-эндпоинты `/coach|/parent/question/[id]/reply`, статусы головы `new→answered→new`, `fanOutQuestionReply` (пуш по направлению автора, без ПДн), `cleanupQuestionRelations` (каскад реплик). Экраны: нитка тренера `/coach/question/[id]`, у родителя `/parent/ask/[id]` + список «Мои переписки». **Миграция `20260716_112725_m4_chat_messages` (batch 5)** накатана по потоку #017 (+догон дрейфа default `policy_version` из #63). Политика 152-ФЗ не бампалась: новых категорий ПДн нет.
- **[#68](https://github.com/Valstan/trener/pull/68) хвосты чата.** Инбокс тренера показывает последнюю реплику нитки; открытие нитки гасит new→read (`MarkRead`). Письмо Мозгу: mojibake от `curl -d` с кириллицей в git-bash/Windows (`mailbox/to-brain/2026-07-16-windows-curl-cyrillic-mojibake.md`).

Тесты 119 → **135**. Все флоу проверены вживую (включая изоляцию чужого родителя и mark-read через браузер).

## Следующий шаг

**Дорожная карта исчерпана — дальше за владельцем:**
- ⚠️ Фото/видео-галереи — отложены (детские медиа, юридически тяжёлое).
- go-live 152-ФЗ (реквизиты оператора + РКН) — трекер в [`docs/PENDING_FOLLOWUPS.md`](PENDING_FOLLOWUPS.md), ждёт решения о запуске «вживую».
- Возможная идея из вопроса владельца 2026-07-16: **открытая само-регистрация с модерацией** («заявка в школу») — сейчас онбординг только по инвайту (осознанно, 152-ФЗ). Не начинали — обсудить объём, если владелец захочет.

## ⚠️ Контекст этой сессии (не потерять)

- **Фаза — закрытое тестирование на вымышленных данных**; go-live-гейт открыт намеренно (`OPERATOR_FINALIZED=false`), см. PENDING_FOLLOWUPS.
- **Порядок статусов чата:** реплика родителя возвращает голову в `new`; ответ тренера (`reply`) сам ставит `answered` — кнопка «Ответил» в инбоксе осталась для оффлайн-ответов.
- **Грабля curl+кириллица (Windows/git-bash):** `-d` с литеральной кириллицей кладёт mojibake в БД; слать `--data-binary @file` из UTF-8-файла, проверки писать в UTF-8-файл (консоль cp866 маскирует). Письмо Мозгу ушло.
- **Postgres на PC40 (`postgresql-x64-17`, порт 5433)** тоже ложится, как на rmz4val, и `Start-Service` из обычной оболочки даёт Access denied — поднимать элевейтед: `powershell Start-Process powershell -Verb RunAs -ArgumentList '-Command Start-Service postgresql-x64-17'`.
- **Дев-сервер, стартовавший при лежащей БД, не сделал drizzle-push** — после подъёма Postgres перезапустить сервер, иначе новых таблиц нет.

## Контекст — ПРОД (Бокс 1)

- **Бокс:** myjino VPS `831d0ce99bdf.vps.myjino.ru` (SSH-алиас `GONBA`/`TRENERBOX`, user `valstan`, passwordless sudo). trener — **:3007**; KARMAN — **:3002**. **Postgres 16.14**. Домен `интер.вмалмыже.рф` (`xn--e1afpni.xn--80adkdyec4j.xn--p1ai`).
- **БД `trener`** + роль `trener_app`. `payload_migrations`: baseline(1) … matches(4) + **m4_chat_messages(5)**. `releases/current` = `8ceb8c8` (= main HEAD).
- **Деплой:** авто при мерже (`deploy-prod.yml` workflow_run после CI) ИЛИ `workflow_dispatch`. Схемные правки — поток #017 ([`docs/migrations.md`](migrations.md)): миграция на ветке ДО мержа (`apply-migration.yml --ref <ветка>`) → мерж → авто-деплой падает на migration-guard (ожидаемо) → ручной deploy. **Без миграций** авто-деплой проходит штатно.
- **`/etc/trener/`** (#008): `trener.env` (RADAR_* + 17 ключей) · `secrets-token.env` (KARMAN) · `trener-backup.env` · `backup-pubkey.asc`. Зеркало в KARMAN (ADR-0006).
- Внешний smoke с бокса: `curl --resolve $dom:443:127.0.0.1 https://$dom/health` (снаружи punycode-гадание не нужно — домен выше).

## Контекст — DEV

- Машины: **PC40** (эта, `D:\GitHubReps\`, Postgres 17 на **5433**) и rmz4val (`D:\PROGRAMMING\`, порт 5432) — профили в [`docs/machines/`](machines/README.md); psql не в PATH (полный путь в профиле).
- Каркас: Payload 3.75 / Next 15.4, **13 коллекций** (+ QuestionMessages), **135 юнит-тестов**. Мержим вручную `gh pr merge --squash --delete-branch` по зелёному CI. Гейты CI: lint/typecheck/test/knip/build.
- **Сид demo-данных:** `corepack pnpm -C web seed` — перевыпускает magic-link без потери данных (тренер Иван Петров, родители Ольга/Дмитрий/Елена, админ admin@trener.local/devpass1234).
- Верификация миграции перед PR: раздел «Верификация» в [`docs/migrations.md`](migrations.md) (на PC40 — порт 5433, пароль из `web/.env`).

## Хвосты (не блокеры)

- Открытых кодовых хвостов нет. Следующее — по решению владельца (см. «Следующий шаг»).
