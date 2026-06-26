# Машина: rmz4val

> Per-machine профиль ([pool #050](../../../brain_matrica/cross-project-ideas/ideas/050-per-machine-env-profiles.md)). **Без секретов** (#008).
>
> ⚠️ **Сид-черновик, заведён с PC40 (2026-06-26) по справке из соседних репо — на самой rmz4val ещё НЕ сверен для trener.** Первая же сессия trener с этой машины: проверить факты, заполнить dev-БД, убрать это предупреждение.

**Hostname:** `rmz4val`
**Роль:** домашний компьютер. WORKSPACE_ROOT = `D:\PROGRAMMING\` (НЕ `D:\GitHubReps\` как на PC40). Вторая машина — `PC40` (работа).
**Shell:** PowerShell + Git Bash.

## Известно из профилей соседей (brain_matrica/MatricaRMZ `docs/machines/rmz4val.md`)

- **pnpm НЕ в PATH** (в отличие от PC40) → проектные команды строго через **`corepack pnpm`** (для trener это и так нужно — пинится `pnpm@10.15.0`).
- python 3.14.3 (на PC40 — 3.11.9; версии расходятся, для trener не критично).
- Корень репозиториев — `D:\PROGRAMMING\`, не `D:\GitHubReps\`.

## Dev-БД для trener — ВЫЯСНИТЬ НА МЕСТЕ

Не проверено с этой машины. При первом запуске trener здесь:
- Есть ли локальный PostgreSQL, на каком порту, какой пароль суперюзера.
- Создать БД `trener_dev`, прописать `web/.env` (`DATABASE_URL`, `PAYLOAD_SECRET`, `NEXT_PUBLIC_SERVER_URL`, VAPID_*, `CRON_SECRET`) по `web/.env.example`.
- `corepack pnpm -C web dev` → `push:true` материализует схему.

## Машинные грабли trener

- (заполнять по мере работы с этой машины)
