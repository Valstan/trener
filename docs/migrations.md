# Прод-миграции схемы (Payload + drizzle) — runbook

> Как менять схему прод-БД trener без ручного push'а через туннель. Заведено в PR12 (#017).
> Прод держит **детские ПДн** (152-ФЗ) → схема меняется только так: предсказуемо,
> ревьюимо в PR, транзакционно, с записью в реестр.

## TL;DR порядка действий при изменении схемы

1. Поменял коллекцию/поле в `web/src/collections/*` или `payload.config.ts`.
2. Локально dev-push материализовал схему (поднять dev-сервер один раз) — это и есть «эталон».
3. `corepack pnpm -C web migrate:create <имя>` → сгенерит `web/src/migrations/<ts>_<имя>.{ts,json}` + обновит `index.ts`.
4. **Проверить миграцию на чистой БД** (раздел «Верификация» ниже) — что `payload migrate` даёт схему 1:1 с push-сборкой.
5. Подчистить варнинги lint (сигнатуры `up`/`down` → `{ db }`), `corepack pnpm -C web typecheck && lint && test`.
6. Коммит, PR, **зелёный CI**.
7. **ДО мержа** накатить миграцию на прод: Actions → **«Apply DB migration (manual)»** → Run workflow на **ветке фичи** (`gh workflow run apply-migration.yml --ref <branch>`).
8. Смержить PR. Авто-деплой (`workflow_run`) **упрётся в migration-guard и упадёт — это ожидаемо** (защита «код не раньше схемы»).
9. Задеплоить код вручную: Actions → **«Deploy to production»** → Run workflow (`workflow_dispatch` обходит guard, т.к. схема уже накатана).

Порядок «схема → код» обязателен: новый код, ждущий колонку, которой ещё нет → 500-е.

## Почему так (архитектурные решения PR12)

- **Единый источник правды — `.ts`-миграция.** Никаких зеркальных `.sql` (как у GONBA/Sabantuy
  по #017): нечему молча дрейфовать с `.ts`. Расхождение с библиотекой осознанное —
  см. письмо в `mailbox/to-brain/` про single-source + транзакционность.
- **Накат — нативным `payload migrate` из CI по SSH-туннелю** (`apply-migration.yml`), не
  `psql -f`. Плюсы: каждая миграция идёт **транзакцией** (откат при ошибке — у сырого
  `psql -f` без `BEGIN/COMMIT` падение оставляет схему наполовину), реестр `payload_migrations`
  пишется нативно, DR-сборка с нуля = просто `payload migrate` на пустой БД.
- **Почему из CI, а не на боксе:** прод-артефакт — standalone (runtime-only), payload-CLI в
  нём нет. Раннер имеет полный `node_modules` после install; БД достаём коротким туннелем к
  `127.0.0.1:5432` бокса. Туннель живёт внутри одного шага (trap гасит) + раннер эфемерный →
  утёкший форвард не добьёт `CONNECTION LIMIT` роли (ср. G103/#050 — там беда от ЛОКАЛЬНЫХ туннелей).
- **`push` в проде выключен** (`payload.config.ts`: `push: NODE_ENV !== 'production'`) — у
  `payload migrate` тоже ставим `NODE_ENV=production`, чтобы init не дёргал drizzle-push (G20/завис на y/N).
- **`payload.config` НЕ трогаем для подключения миграций** — Payload берёт `src/migrations` по
  дефолтной конвенции.

## Baseline (миграция `20260627_055816_baseline`)

Полный снимок схемы на момент ввода миграций. Сгенерён `migrate:create` на dev-БД **без дрейфа
снапшота** (у trener не было ручных миграций) → генератор выдал чистый полный DDL, включая все
`_v`/`*_rels`/`payload_locked_documents_rels` (поэтому **G35 не грозит** — он про ручной точечный
`pg_dump -t`, а тут весь конфиг разом). Проверено 1:1: `pg_dump --schema-only` migrate-сборки ==
push-сборки построчно (кроме per-session токена pg_dump).

### Разовый засев прода (делается ОДИН раз для baseline)

На проде схема **уже существует** (первый деплой M3 — pre-push через туннель), поэтому baseline
там **не запускают** (его `up` — голые `CREATE TABLE`, упадут на «уже существует»), а **помечают
применённым** в реестре. Иначе `payload migrate` попробует прогнать baseline и упадёт.

```bash
# с rmz4val (локальный SSH к боксу работает) — одной строкой через psql на боксе:
ssh GONBA "sudo -u postgres psql -d trener -c \
  \"INSERT INTO payload_migrations (name, batch) SELECT '20260627_055816_baseline', 1 \
    WHERE NOT EXISTS (SELECT 1 FROM payload_migrations WHERE name='20260627_055816_baseline');\""
```

После засева `payload migrate:status` на проде покажет baseline как applied, а будущие дельты
(их таблиц на проде ещё нет) накатятся `payload migrate` начисто.

> ⚠️ **Сентинел `(dev, -1)` ОБЯЗАТЕЛЬНО удалить из прод-`payload_migrations` при засеве baseline.**
> Это остаток первого dev-push'а через туннель (M3). На `migrate:status` он и правда не влияет, НО
> сам `payload migrate` (apply) видит строку с `name='dev'` и **интерактивно спрашивает**
> «It looks like you've run Payload in dev mode… data loss will occur. Proceed? (y/N)» — даже при
> `NODE_ENV=production` (это НЕ drizzle-push-промпт, его production гасит, а отдельная проверка
> команды `migrate`). В CI стдин пустой → промпт висит до таймаута job'а и `apply-migration.yml`
> падает с `The operation was canceled` (проявилось на ПЕРВОМ реальном `payload migrate` 2026-06-27;
> baseline засевался прямым INSERT, поэтому раньше не всплывало). Лечение — один раз снести сентинел:
>
> ```bash
> ssh GONBA "sudo -u postgres psql -d trener -c \"DELETE FROM payload_migrations WHERE name='dev' AND batch=-1;\""
> ```
>
> Прод на формальных миграциях — dev-режима там нет, строка лишняя. После удаления `payload migrate`
> применяет дельты без промпта.

## Верификация новой миграции (перед PR)

Доказать, что `.ts` строит ровно ту же схему, что dev-push:

```bash
PSQL="/c/Program Files/PostgreSQL/17/bin/psql"; export PGPASSWORD=postgres
"$PSQL" -U postgres -h 127.0.0.1 -p 5432 -d postgres -c "DROP DATABASE IF EXISTS trener_mig_verify;"
"$PSQL" -U postgres -h 127.0.0.1 -p 5432 -d postgres -c "CREATE DATABASE trener_mig_verify;"
# применить ВСЕ миграции на чистую БД (push off):
DATABASE_URL="postgresql://postgres:postgres@127.0.0.1:5432/trener_mig_verify" \
  NODE_ENV=production corepack pnpm -C web migrate
# сравнить со схемой dev (push-сборка):
PGD="/c/Program Files/PostgreSQL/17/bin/pg_dump"
"$PGD" -U postgres -h 127.0.0.1 -p 5432 --schema-only --no-owner --no-privileges -d trener_dev       > /tmp/dev.sql
"$PGD" -U postgres -h 127.0.0.1 -p 5432 --schema-only --no-owner --no-privileges -d trener_mig_verify > /tmp/ver.sql
diff <(grep -vE '^\s*(--|\\restrict|\\unrestrict|$)' /tmp/dev.sql) \
     <(grep -vE '^\s*(--|\\restrict|\\unrestrict|$)' /tmp/ver.sql) && echo "*** IDENTICAL ***"
"$PSQL" -U postgres -h 127.0.0.1 -p 5432 -d postgres -c "DROP DATABASE trener_mig_verify;"
```

Пусто (IDENTICAL) = миграция точна. Есть дифф = `.ts` не догоняет конфиг (доправить руками).

## Грабли

- **Версионируемые коллекции (`drafts:true`/versions) — G7.** Новое поле уезжает и в зеркальную
  `_<coll>_v` как `version_<field>`. `migrate:create` это делает сам; при ручной правке не забыть.
- **Снапшот-дрейф (#017).** Если когда-нибудь начнём править миграции руками, `migrate:create`
  может выдать мусорный дифф (снапшот `*.json` отстал). Тогда — push-inspect-handwrite по #017.
- **apply-before-merge → всегда `--ref <feature-branch>`** (G28): `workflow_dispatch` без `--ref`
  чекаутит `main`, где файла миграции ещё нет.
- **`apply-migration.yml` падает `The operation was canceled` (висит до таймаута на шаге migrate).**
  Симптом: `migrate:status` (до) проходит, а `migrate` (apply) виснет ~15 мин и job убивается.
  Причина: сентинел `(dev, -1)` в прод-`payload_migrations` → `payload migrate` ждёт ответа на
  интерактивный «run in dev mode… proceed? (y/N)» (стдин в CI пуст). Лечение — снести сентинел
  один раз (см. блок ⚠️ в «Разовый засев прода»). НЕ путать с drizzle-push-промптом (тот гасится
  `NODE_ENV=production`).
- **Локальный фолбэк (если CI/раннер недоступен):** с rmz4val открыть туннель
  `ssh -fNL 15432:127.0.0.1:5432 GONBA`, затем
  `DATABASE_URL=<прод-url с :15432> NODE_ENV=production corepack pnpm -C web migrate`,
  и **закрыть туннель по PID** (`netstat -ano | grep 15432` → `taskkill //F //PID`), иначе
  утёкший форвард добивает `CONNECTION LIMIT` роли (G103).
