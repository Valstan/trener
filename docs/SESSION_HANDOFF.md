# trener — Session Handoff

> Sticky-note для непрерывности сессий. Перезаписывается `/close_session`. История через `git log -- docs/SESSION_HANDOFF.md`.

**Status:** ACTIVE
**Updated:** 2026-06-24 (M1 PR1 + проектные `.claude`-команды смержены в main)
**Branch:** main

## Текущая нитка

**M1 (каркас + 152-ФЗ floor) — в работе, режется на 3 PR.** Смержено:
- **[#2](https://github.com/Valstan/trener/pull/2)** — каркас Payload+Next + модель данных + роли authz (#015).
- **[#3](https://github.com/Valstan/trener/pull/3)** — проектные slash-команды (`/start`, `/close_session`, `/obriv`) + `.claude/settings.json`/`launch.json`.

## Следующий шаг

**PR2 — magic-link онбординг (без пароля) + invite-код тренера** (kickoff §7.1 — адопшен-критично: первое открытие <30с решает выживание продукта). Payload auth strategy (disableLocalStrategy + кастомный verify-токен/endpoint), invite-код тренера → создание parent-аккаунта + привязка Player.
Затем **PR3** — PWA (manifest/SW/install) + 152-ФЗ статика (политика + UX согласия). Затем **docs** (incident-playbook) + **ack-письмо brain** по готовности всего M1.

## Контекст

- **Каркас `web/`** готов: Payload 3.75 / Next 15.4 / React 19 / Postgres, 1:1 по Sabantuy. Коллекции: Users(admin|coach|parent), Groups, Players, TrainingSessions(=Events+`status`), Consents(=Registrations, 152-ФЗ).
- **Verify-гейты зелёные** (`pnpm typecheck/build/lint/knip`). ⚠️ **Рантайм-boot БД НЕ проверен** — нет локального Postgres/Docker (порт 5432 пуст). create-first-user / push-схемы / фактический прогон access → перенесено на **deploy-smoke #011 (веха M3)**. При появлении dev-БД — поднять `corepack pnpm -C web dev`, завести первого пользователя (станет admin), проверить скоупинг ролей.
- **authz #015 (day-1):** async access возвращает `Where`; coach→свои группы, parent→свои дети; служебные `find` с `overrideAccess` (разрыв рекурсии — находка отправлена brain).
- **Bootstrap:** первый пользователь → admin (`ensureFirstUserAdmin`). Секреты вне репо (`web/.env` локально, `/etc/trener/` на проде, #008).
- **Команды/CI:** `.claude/` команды активны на main. CI/деплой и команды `reliz`/`sql`/`check` (по образцу GONBA) — на M3, когда появится `deploy-prod.yml`.
- **Решения владельца (06-24):** PWA-first (не RN); чат — M4 (в MVP суррогат «вопрос тренеру»); тренеры правят свои группы.
