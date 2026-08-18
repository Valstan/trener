/**
 * Сид демо-филиала D-029 — обёртка `payload run` вокруг `seedDemo`.
 *
 * В отличие от `seed-dev.ts` (dev-only, стенд для разработки) этот скрипт
 * запускается КАЖДУЮ ночь по крону и НА ПРОДЕ тоже — он предохраняется не по
 * имени БД, а тем, что вся его работа (снос + посев) ограничена ОДНИМ филиалом
 * `isDemo: true`: см. `seedDemo.ts` для деталей where-фильтров.
 *
 * Запуск: corepack pnpm -C web payload run ./src/scripts/seed-demo.ts
 *
 * Идемпотентность (#139): двойной прогон подряд должен вернуть одинаковые
 * счётчики (снос предыдущего посева перед новым; демо-юзеры — стабильные id,
 * find-or-create, не пересоздаются).
 *
 * Импорты — относительные (граф загрузки конфига чист от алиаса `@/`), чтобы не
 * зависеть от резолва tsconfig-путей в `payload run` (как в seed-dev.ts).
 */
import { getPayload } from 'payload'

import config from '../payload.config'
import { seedDemo } from '../lib/demo/seedDemo'

const payload = await getPayload({ config })

const result = await seedDemo(payload)

payload.logger.info(
  `[seed-demo] филиал #${result.branchId}, счётчики: ${JSON.stringify(result.counts)}`,
)
console.log('\n[seed-demo] готово:', JSON.stringify(result, null, 2), '\n')

process.exit(0)
