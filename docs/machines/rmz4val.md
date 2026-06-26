# Машина: rmz4val

> Per-machine профиль ([pool #050](../../../brain_matrica/cross-project-ideas/ideas/050-per-machine-env-profiles.md)). **Без секретов** (#008).
>
> ✅ **Сверено на месте 2026-06-26** (первая сессия trener с этой машины). Dev-БД, pnpm, прогон каркаса — проверены живьём.

**Hostname:** `rmz4val`
**Роль:** домашний компьютер. WORKSPACE_ROOT = `D:\PROGRAMMING\` (НЕ `D:\GitHubReps\` как на PC40). Вторая машина — `PC40` (работа).
**Shell:** PowerShell + Git Bash.

## pnpm

- **pnpm НЕ в PATH** (в отличие от PC40) → проектные команды строго через **`corepack pnpm`** (corepack сам тянет пин `pnpm@10.15.0`). Подсказку «update 10.15.0 → 11.9.0» **игнорировать** — проект пинит 10.15.
- После pull PR, менявшего `web/pnpm-lock.yaml`: `cd web && corepack pnpm install` (иначе typecheck падает `Cannot find module`). Канарейка рассинхрона: нет `web/node_modules/web-push` → лок-файл новее node_modules (PR8 добавил `web-push`).

## Dev-БД для trener (сверено)

- **Postgres 17.10**, бинарь psql: `C:\Program Files\PostgreSQL\17\bin\psql`.
- **Два сервиса**: использовать **`postgresql-x64-17`** (StartType **Manual** → стартовать вручную в начале сессии: `Start-Service postgresql-x64-17`, без elevation сработало). Старый сервис `PostgreSQL` — **Disabled**, не трогать.
- **Порт 5432** (НЕ 5433 как на PC40!). `postgresql.conf` → `port = 5432`. `web/.env` указывает на `127.0.0.1:5432`.
- БД **`trener_dev`** уже создана, суперюзер `postgres` / пароль `postgres`, схема M2 полностью материализована (`push:true`), таблицы пустые (сид-данных нет).
- Инстанс **общий** на несколько проектов: `gonba`, `sabantuy`, `matricarmz_dev`, `matricarmz_probe`, `vmalmyzhe_build`, `trener_dev` — не путать/не дропать чужие.

## web/.env (gitignored, #008)

- `DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/trener_dev`, `PAYLOAD_SECRET`, `NEXT_PUBLIC_SERVER_URL=http://localhost:3000`.
- Дописаны dev-ключи (2026-06-26): VAPID-пара (`NEXT_PUBLIC_VAPID_PUBLIC_KEY`/`VAPID_PRIVATE_KEY`/`VAPID_SUBJECT`) + `CRON_SECRET=dev-cron-secret-rmz4val`. Шаблоны — `web/.env.example`. Реальная доставка push iOS/Android требует HTTPS (M3).

## Запуск / верификация (сверено 2026-06-26)

- Dev-сервер: `corepack pnpm -C web dev` (порт **3000**) — поднимается, главная рендерится, ошибок БД нет. Через preview-инструмент: конфиг `web-dev` в `.claude/launch.json`.
- `corepack pnpm -C web typecheck` — чисто. `corepack pnpm -C web test` — **67/67** зелёные.
- Скрипты Payload (если нужны): `./node_modules/.bin/payload run ./script.ts` (нужен top-level await).

## Машинные грабли trener

- (заполнять по мере работы с этой машины)
