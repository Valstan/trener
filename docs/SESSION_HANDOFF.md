# trener — Session Handoff

> Sticky-note для непрерывности сессий. Перезаписывается `/close_session`. История через `git log -- docs/SESSION_HANDOFF.md`.

**Status:** ACTIVE
**Updated:** 2026-06-26 (M3 = ПЕРВЫЙ ПРОД сдан — объявления + «вопрос тренеру» + деплой на Бокс 1; живёт на `https://интер.вмалмыже.рф`)
**Branch:** main

## Текущая нитка

**M3 «первый прод lovable MVP» завершён продуктово** (kickoff §8). Все три нитки сделаны и **в проде**:

- **[#30](https://github.com/Valstan/trener/pull/30) PR10 — объявления.** Коллекция `Announcements` (author/group/title/body/triggersPush/publishedAt) + `fanOutAnnouncement` (afterChange create + флаг → best-effort `normal`-пуш родителям группы, **НЕ создаёт Notifications**, coverage не трогает — F1) + компоновщик `/coach/announcements` + `POST /coach/announcement` + лента на `/parent` (`AnnouncementsFeed`, «новое» через localStorage F6). Блюпринт — [`docs/m3-design.md`](m3-design.md).
- **[#33](https://github.com/Valstan/trener/pull/33) PR11 — «вопрос тренеру»** (суррогат чата). Коллекция `Questions` (parent/group/session?/body/status new→read→answered), read scoped (родитель свои, тренер по группам `coachGroupIds`), create server-only, update adminOnly. `fanOutQuestion` → пуш тренерам группы. `POST /parent/question` + `POST /coach/question/[id]/status` + инбокс `/coach/questions` + `QuestionForm` на `/parent`. Односторонне — двусторонний чат = M4 (тогда `Questions` → Threads/Messages).
- **Деплой ([#31](https://github.com/Valstan/trener/pull/31)/[#32](https://github.com/Valstan/trener/pull/32))** — `payload.config` push гейтится `NODE_ENV` (прод не пушит), `/health`, `deploy/systemd/trener.service`, `.github/workflows/deploy-prod.yml` (standalone на node20, service-postgres без туннеля, scp → systemd restart → smoke).

Найденные M2 (#29) и ранее M1/M2 (PR1–9) — в проде. brain уведомлён (`mailbox/to-brain/2026-06-26-m3-first-prod-box1-findings.md`) — закрывает welcome+kickoff/M1-ack + 3 pool-находки.

## Следующий шаг

**PR12 — прод-миграции (#017)** — главный технический долг. Сейчас прод-схема без формальных миграций: `push` выключен в проде, новые таблицы доливаются **вручную pre-push'ем через SSH-туннель** (делал для `announcements` и `questions`). Не масштабируется → перевести на Payload-миграции (как GONBA `deploy-prod.yml` guard + ручное применение до merge). Спросил brain про отлаженный рецепт в письме.

Параллельно (не блокеры): offsite-бэкапы прод-БД (PII детей, обязательно по плану brain); systemd-таймер cron RSVP-напоминаний (`/cron/rsvp-reminders` + `CRON_SECRET`).

**Гейты go-live (действия владельца, вне кода):** РКН-уведомление до приёма реальных ПДн детей; реквизиты оператора в `web/src/lib/operator.ts` + `OPERATOR_FINALIZED=true` (уберёт черновик-плашку с `/privacy`); **SMTP-relay** в `/etc/trener/trener.env` (сейчас magic-link пишется в консоль → реальный родитель не залогинится).

## Контекст — ПРОД (Бокс 1 = сервер GONBA, появилось в этой сессии)

- **Бокс:** myjino VPS `831d0ce99bdf.vps.myjino.ru` (user `valstan`), SSH с rmz4val по `~/.ssh/id_ed25519`. Это «Бокс 1» консолидации — на нём gonba(:3000)/karman(:3002)/vmalmyzhe(:3004)/dkmalmyzh(:3005)/kalinino(:3006), trener — **:3007**. RAM ~2 ГБ (used ~1.1), trener-рантайм ~140 MB.
- **Домен:** `интер.вмалмыже.рф` → punycode **`xn--e1afpni.xn--80adkdyec4j.xn--p1ai`** (wildcard `*.вмалмыже.рф` уже резолвится на бокс — 0 DNS-правок). nginx-vhost `trener` → 127.0.0.1:3007, TLS certbot `--cert-name trener` (auto-renew, до 24 сен). Тех-хостнейм VPS занят KARMAN'ом и поддомены на нём НЕ резолвятся (зона myjino).
- **Postgres (на боксе):** БД `trener` + роль `trener_app` (изоляция `REVOKE CONNECT FROM PUBLIC`), **`CONNECTION LIMIT 20`** (поднял с 10 — утёкшие через туннель коннекты добивали лимит при pre-push, само приложение держит ~1). Пароль — в `/etc/trener/trener.env` (root:valstan 0640).
- **Секреты:** `/etc/trener/trener.env` (#008): DATABASE_URL, PAYLOAD_SECRET, NEXT_PUBLIC_* (punycode-URL + прод VAPID public), VAPID_PRIVATE_KEY, CRON_SECRET. **Нет SMTP_*** (go-live). Прод VAPID-пара ОТДЕЛЬНАЯ от dev.
- **Деплой:** авто при мерже в main (`deploy-prod.yml`, workflow_run после CI). Секрет репо `SSH_PRIVATE_KEY` = выделенный deploy-ключ (pub в `authorized_keys` бокса). `NEXT_PUBLIC_VAPID_PUBLIC_KEY` + URL зашиты в workflow (публичны). Релизы: `/home/valstan/trener/releases/<sha>` + симлинк `current`, держим 3.
- **⚠️ Долив прод-схемы (до PR12):** новая коллекция → схема в прод не появится сама (push off). Лить так: взять пароль `ssh GONBA "grep DATABASE_URL /etc/trener/trener.env" | tr -d '\r'`, открыть туннель `ssh -fNL 15432:127.0.0.1:5432 GONBA`, `DATABASE_URL=...@127.0.0.1:15432/trener NODE_ENV=development payload run <init-script>` (getPayload → push), **закрыть туннель по win-PID** (`netstat -ano | grep 15432` → `taskkill //F //PID`). pre-push ДО мержа (таблица без кода безопасна).

## Контекст — DEV (rmz4val, эта машина)

- Профиль сверен: [`docs/machines/rmz4val.md`](machines/README.md). Postgres 17 `postgresql-x64-17` (Manual, **порт 5432** — НЕ 5433 как на PC40), БД `trener_dev`, pnpm только `corepack pnpm` (10.15). `web/.env` (gitignored) с dev VAPID + `CRON_SECRET`.
- **node на rmz4val = v24** → standalone собирать локально нельзя (бокс node20) — только CI.
- Каркас: Payload 3.75 / Next 15.4. Коллекции: Users/Groups/Players/TrainingSessions/Consents/LoginTokens/Devices/Notifications/Rsvps/**Announcements/Questions**. **75 юнит-тестов** зелёные. Авто-мерж отключён (#027) — мержим вручную `gh pr merge --squash --delete-branch` по зелёному CI.

## Хвосты (не блокеры)

- DB partial-unique индексы (C4 с M2): `(session,player)` на Rsvps + dedup на фан-ауте — в PR12-миграции.
- Каскады delete Player/User (FK `SET NULL` ⨯ `NOT NULL`) — beforeDelete-чистка, редкое admin-действие.
- deprecation-warning `pnpm/action-setup@v4` на node20-раннере (GitHub) — косметика.
