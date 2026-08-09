import { createHash } from 'crypto'

import type { Payload } from 'payload'

import type { LegalDocument } from '@/payload-types'
import { isOperatorFinalized, operatorFromBranch, type OperatorBranch, type OperatorDetails } from '@/lib/operator'

// Версионируемые юридические документы (D-016, решение владельца 09.08):
// договор поручения на обработку ПДн и согласие родителя живут в БД как данные,
// правятся через админку (не через релиз), старые версии никогда не переписываются.
// Подпись — неизменяемая журнальная запись (legal-signatures) с hash версии.

export type LegalKind = 'processing_agreement' | 'parent_consent'

// Хэш содержимого версии: то, «под чем» подписывается человек. Считается по
// ШАБЛОНУ (с {{плейсхолдерами}} реквизитов) — конкретные реквизиты филиала на
// момент подписи фиксируются отдельным снапшотом в журнале. Kind и version входят
// в хэш, чтобы перенос текста между документами тоже менял отпечаток.
export const legalContentHash = (kind: string, version: string, body: string): string =>
  createHash('sha256').update(`${kind}\n${version}\n${body}`, 'utf8').digest('hex')

// Иммутабельность опубликованной версии: после publishedAt менять kind/version/body
// нельзя — только выпустить новую версию. Чистый предикат (юнит-тест); хук коллекции
// применяет его к originalDoc/data.
export const publishedFieldsFrozen = (
  original: { publishedAt?: string | null; kind?: string | null; version?: string | null; body?: string | null },
  data: { kind?: unknown; version?: unknown; body?: unknown },
): boolean => {
  if (!original.publishedAt) return false
  const changed = (field: 'kind' | 'version' | 'body') =>
    data[field] !== undefined && data[field] !== original[field]
  return changed('kind') || changed('version') || changed('body')
}

// Действующая версия документа: последняя опубликованная данного вида.
export const activeDocument = async (payload: Payload, kind: LegalKind): Promise<LegalDocument | null> => {
  const found = await payload.find({
    collection: 'legal-documents',
    where: { and: [{ kind: { equals: kind } }, { publishedAt: { exists: true } }] },
    sort: '-publishedAt',
    limit: 1,
    depth: 0,
    pagination: false,
    overrideAccess: true,
  })
  return found.docs[0] ?? null
}

// Жёсткий гейт D-016: филиал принимает согласия родителей только с полными
// реквизитами оператора И подписанным договором поручения. isOperatorFinalized
// уже включает дату договора — экран подписания школы её и проставляет.
export const branchCanAcceptConsents = (branch: OperatorBranch): boolean => isOperatorFinalized(branch)

// Реквизиты заполнены, но договор ещё не подписан — состояние «готов подписывать».
export const requisitesComplete = (branch: OperatorBranch): boolean => {
  const operator = operatorFromBranch(branch)
  return Boolean(
    operator.name && operator.legalForm && operator.inn && operator.address && operator.email && operator.phone,
  )
}

// Подстановка реквизитов филиала в шаблон версии. Неизвестные плейсхолдеры
// оставляем как есть (видны глазами — лучше, чем молча пустое место).
export const renderLegalBody = (body: string, operator: OperatorDetails, extras?: Record<string, string>): string => {
  const map: Record<string, string> = {
    OPERATOR_NAME: operator.name,
    OPERATOR_LEGAL_FORM: operator.legalForm,
    OPERATOR_INN: operator.inn,
    OPERATOR_ADDRESS: operator.address,
    OPERATOR_EMAIL: operator.email,
    OPERATOR_PHONE: operator.phone,
    OPERATOR_RESPONSIBLE: operator.responsiblePerson ?? '',
    ...extras,
  }
  return body.replace(/\{\{([A-Z_]+)\}\}/g, (whole, key: string) => (key in map ? map[key] : whole))
}
