import type { CollectionBeforeValidateHook } from 'payload'

import { legalContentHash, publishedFieldsFrozen } from '../lib/legal'

// Гейт версии юридического документа (D-016):
//   • contentHash всегда считает СЕРВЕР (клиентское значение перетирается);
//   • опубликованную версию (publishedAt задан в сохранённом доке) менять нельзя —
//     ни текст, ни вид, ни номер версии: только выпустить новую запись.
// Снять публикацию тоже нельзя: на версию могут ссылаться подписи.
export const guardLegalDocument: CollectionBeforeValidateHook = ({ data, originalDoc }) => {
  if (!data) return data

  if (originalDoc?.publishedAt) {
    if (publishedFieldsFrozen(originalDoc, data)) {
      throw new Error('Опубликованная версия неизменяема — выпустите новую версию документа')
    }
    if (data.publishedAt === null) {
      throw new Error('Публикацию нельзя снять: на версию могут ссылаться подписи')
    }
  }

  const kind = (data.kind ?? originalDoc?.kind) as string | undefined
  const version = (data.version ?? originalDoc?.version) as string | undefined
  const body = (data.body ?? originalDoc?.body) as string | undefined
  if (kind && version && body != null) {
    data.contentHash = legalContentHash(kind, version, body)
  }
  return data
}
