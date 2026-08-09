/**
 * Сид первых версий юридических документов (D-016) — dev/ручной запуск:
 *   corepack pnpm payload run ./src/scripts/seed-legal-docs.ts
 * Идемпотентен: существующая пара (kind, version) пропускается.
 * На прод документы заезжают data-частью миграции (та же LEGAL_SEED_DOCS).
 */
import { getPayload } from 'payload'

import config from '../payload.config'
import { LEGAL_SEED_DOCS } from '../lib/legalSeedTexts'

const payload = await getPayload({ config })

for (const doc of LEGAL_SEED_DOCS) {
  const existing = await payload.find({
    collection: 'legal-documents',
    where: { and: [{ kind: { equals: doc.kind } }, { version: { equals: doc.version } }] },
    limit: 1,
    depth: 0,
    pagination: false,
    overrideAccess: true,
  })
  if (existing.docs.length) {
    payload.logger.info(`[seed-legal] ${doc.kind}@${doc.version} уже есть — пропуск`)
    continue
  }
  await payload.create({
    collection: 'legal-documents',
    data: { ...doc, publishedAt: new Date().toISOString() },
    overrideAccess: true,
  })
  payload.logger.info(`[seed-legal] создан ${doc.kind}@${doc.version}`)
}

process.exit(0)
