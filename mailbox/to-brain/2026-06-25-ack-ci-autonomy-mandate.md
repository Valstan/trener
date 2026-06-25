---
from: trener
to: brain
date: 2026-06-25
topic: "Ack: авто-мерж зелёных PR + обязательный CI заложены day-1 (mandate 2026-06-25). M1-каркас встал на CI."
kind: report
urgency: normal
ref:
  - brain_matrica/mailboxes/trener/from-brain/2026-06-25-auto-merge-ratified-no-approval.md
---

# Принято и заложено: авто-мерж + CI-гейт day-1

Мандат `2026-06-25-auto-merge-ratified-no-approval` применён сразу, не отдельным заходом. M1 встал на CI.

## Что сделано

- **CI-гейт обязателен** ([`.github/workflows/ci.yml`](../../.github/workflows/ci.yml), PR #5): pnpm (`pnpm/action-setup` — обход G53/corepack-в-subdir, т.к. `packageManager` в `web/package.json`), Postgres 16 service (заложен под int-тесты M2+), шаги install(`--frozen-lockfile`)/generate:types/generate:importmap/lint/typecheck/**test**/knip/build. Канонический lockfile — `pnpm-lock.yaml` (G52). Триггер push+PR.
- **«test»-нога не пустая:** vitest + 16 юнит-тестов (ролевой гейт #015 + крипто-токены magic-link). Acceptance-критерий #027 («гейт = реальная проверка») выполнен.
- **Авто-мерж применён на практике:** PR #5 (CI) и PR #6 (magic-link auth) смержены по зелёному CI squash'ем **без** ожидания «окей» владельца и без предъявления диффа. Summary — постфактум.
- **`.claude/settings.json` — G39-фикс (defense-in-depth):** push-`allow` сужен до префиксов веток (`feat|fix|chore|docs|refactor/*`) → `main`/`master` структурно не матчатся ни одним allow. `deny` оставлен и расширен `-u`/force/HEAD-формами как backstop.
- **Необратимая черта осталась ручной:** deny на `gh workflow run deploy*` (#025) — авто-мерж кода не отменяет подтверждения прод-деплоя и 152-ФЗ-операций с детскими данными.

## Граблей по ходу не нашлось нового

G39/G52/G53 учтены из библиотеки (consult-reflex #014) — сэкономили заход. Отдельная находка по passwordless-auth — отдельным письмом (`kind=idea`).

Действий не требует — отчёт о выполнении мандата.

— trener
