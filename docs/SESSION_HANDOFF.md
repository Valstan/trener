# trener — Session Handoff

> Sticky-note для непрерывности сессий. Перезаписывается `/close_session`. История через `git log -- docs/SESSION_HANDOFF.md`.

**Status:** ACTIVE
**Updated:** 2026-06-25 (CI/авто-мерж заложены + PR2 magic-link онбординг завершён)
**Branch:** main

## Текущая нитка

**M1 (каркас + 152-ФЗ floor) — в работе.** Завершено за сессию 2026-06-25 (5 PR):
- **[#5](https://github.com/Valstan/trener/pull/5)** — CI-гейт (typecheck/lint/test/knip/build + Postgres-сервис) + авто-мерж day-1 (mandate 2026-06-25), G39-фикс `.claude/settings.json`.
- **[#6](https://github.com/Valstan/trener/pull/6)** — magic-link passwordless вход (auth-ядро): `LoginTokens`, `buildAuthCookie` (Payload-native), two-step verify.
- **[#7](https://github.com/Valstan/trener/pull/7)** — письма brain: ack мандата + находка passwordless-Payload (#009).
- **[#8](https://github.com/Valstan/trener/pull/8)** — invite-онбординг родителя: `/join` → привязка ребёнка (после доказанного email) → согласие 152-ФЗ.
- **[#9](https://github.com/Valstan/trener/pull/9)** — кнопка-приглашение тренера в админке (Player sidebar).

**PR2 (magic-link онбординг + invite-код тренера) — закрыт** (#6+#8+#9).

## Следующий шаг

**PR3 — PWA + 152-ФЗ статика (= первый прод по вехам):**
1. PWA: manifest + service worker + install-промпт. Грабли: G59 (manifest на публичном пути, без auth-гейта), G12 (manifest/robots в корне `app/`).
2. 152-ФЗ статика: страница политики обработки ПДн + UX согласия «отдельной бумагой» (сейчас в `/onboarding/consent` — минимальная галка; довести до полноценного акта с текстом политики, версия — `lib/consent.ts` `CONSENT_POLICY_VERSION`).
3. docs: incident-playbook.
Затем **deploy-smoke #011 (M3)** и **ack-письмо brain по готовности всего M1**.

## Контекст

- **Auth/онбординг (PR2):** локальная стратегия НЕ отключена (персонал — пароль в `/admin` + create-first-user bootstrap; родители — magic-link, та же cookie `payload-token`). `LoginTokens` — системная коллекция (server-only, sha256-хеш, single-use, TTL). Поток родителя: тренер генерит `/join/<token>` (кнопка в админке) → родитель вводит email → письмо → клик → привязка ребёнка (idempotent, claim-guard 409) → согласие.
- ⚠️ **Рантайм всего auth/invite/consent НЕ прогнан** — нет локального Postgres. На **deploy-smoke (#011/M3)** проверить вживую: create-first-user → admin; генерацию invite в админке (рендер кастом-компонента `GenerateInviteLink`); `/join`→accept→привязку `player.parent`; запись `Consents`; magic-link вход существующего юзера; что префетч письма не жжёт ссылку (two-step). Email в dev/CI — в консоль (SMTP не задан); на проде — relay (`/etc/trener/`, #008).
- **CI/автономия:** зелёный CI = аппрувер мержа (#027), авто-мерж по зелёному без аппрува. `.claude/settings.json`: `defaultMode auto`, push-allow только префиксы веток (main недостижим, G39), deny на `gh workflow run deploy*`. Необратимый прод-деплой + 152-ФЗ-операции (#025) — подтверждение остаётся.
- **Каркас `web/`:** Payload 3.75 / Next 15.4 / React 19 / Postgres. Коллекции: Users(admin|coach|parent), Groups, Players, TrainingSessions, Consents, LoginTokens. authz #015 day-1 (async access → `Where`; служебные find с `overrideAccess`).
- **Решения владельца:** PWA-first (не RN); чат — M4 (суррогат «вопрос тренеру»); тренеры правят свои группы; invite-воронка — тренер заводит Player, инвайт линкует родителя (выбор 2026-06-25).

## Хвосты на потом (не блокеры)

- **152-ФЗ sequencing:** тренер заводит Player (имя+группа) ДО согласия родителя. Уточнить юр-обоснование (ростер школы) / порядок в PR3.
- **CI дублируется** (push + pull_request триггеры → 2 прогона на PR). Можно сузить (concurrency/path-filter), не блокер.
- **CI-аннотация:** `pnpm/action-setup@v4` тянет Node20-deprecation warning (форсится на Node24) — не падение; обновится с версией экшена.
