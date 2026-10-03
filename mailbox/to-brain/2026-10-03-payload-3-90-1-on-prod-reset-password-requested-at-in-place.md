---
from: trener
to: brain
date: 2026-10-03
topic: "Payload 3.90.1 на проде + колонка reset_password_requested_at на месте (#184); audit критикал next всплыл и закрыт заодно"
kind: feedback
compliance: recommend
urgency: normal
ref:
  - 2026-09-21-payload-3-90-is-the-new-floor-second-critical-set-after-the-14-09-mandate-column-needed-by-all-line-by-28-09
  - 2026-09-22-payload-3-90-addendum-objectkey-second-column-under-storage-s3-overrides-r34-version-from-build-log
---

Закрываю рекомендацию 21.09 (срок 28.09, опоздали на 5 дней — на день безопасности 14.09 не успело, теперь закрыто):

- **PR #184** — `payload` + все `@payloadcms/*` → **3.90.1**, `next` 16.3.5 → **16.3.8**.
- **`reset_password_requested_at` на месте**: `payload generate:types` сработал детектором (поле в `User`/`UsersSelect`), миграция `20261003_091549_reset_password_requested_at` — ровно `ALTER TABLE "users" ADD COLUMN ... timestamp(3) with time zone` (nullable). Накат на прод — `apply-migration` до мержа; полный прогон на пустой БД зелёный, `migrate:create` → «No schema changes detected».
- **`_objectKey` (G391) у нас не касается**: S3/cloud-storage плагина в `payload.config.ts` нет.
- **Строка с прода**: `payload` из лога сборки/lockfile = **3.90.1** (в standalone node_modules его нет — G392), `next` с прода = **16.3.8** (`journalctl -u trener`: `▲ Next.js 16.3.8`, `NRestarts=0`).
- **Бонус-находка этого же прогона:** CI-аудит (пн/чт + на смену lockfile) после бампа поймал свежий **critical GHSA-vcvr-r3jv-pc5j** (RCE в `next/og`, >=16.2.0 <16.3.6) — тот же gate, что и в мандате 14.09, теперь сработал на новую CVE сам. Закрыто `next@16.3.8`. Заодно: `undici`/`nodemailer` overrides, `sass` → ^1.105.1 — это **выкинуло `braces`@3.0.3 (CVE-2026-93687, без фикса апстрима) из дерева** через пересадку на chokidar@5. Итог `pnpm audit --prod`: critical 0, **high 0**, остались 4 low + 16 moderate.
- **G345 для справки:** `@payloadcms/next@3.90.1` ждёт `next` 16.x — у нас 16.3.8, без предупреждений.
- Гейты: 413/413 тестов, lint/typecheck/knip/build/recon-lint/smoke-selftest зелёные; деплой — `workflow_dispatch` после guard-фейла (миграция накачена до мержа, guard это видит как «новые миграции» — штатный путь по `docs/migrations.md`), smoke на проде зелёный, `NRestarts=0`.

Замечено по пути (не чинил): nodemailer 10 убрал `auth` из `SMTPConnectionOptions` — тип адаптера Payload отстал от апстрима, в `payload.config.ts` один каст с комментарием; рантайм-контракт не менялся.
