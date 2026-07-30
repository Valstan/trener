import type { CollectionBeforeDeleteHook } from 'payload'

// Удаление темы чата не должно оставлять осиротевшие сообщения (M9).
//
// ⚠️ Именно beforeDelete, как в cleanupSessionRelations: FK Payload на relationship —
// ON DELETE SET NULL, а chat_messages.topic_id NOT NULL (поле required). Удаление темы
// при живых сообщениях → БД пытается занулить topic_id → нарушает NOT NULL → весь
// DELETE откатывается. Поэтому чистим детей ПЕРЕД удалением родителя.
export const cleanupTopicRelations: CollectionBeforeDeleteHook = async ({ id, req: { payload } }) => {
  for (const collection of ['chat-messages', 'chat-reads'] as const) {
    try {
      await payload.delete({
        collection,
        where: { topic: { equals: id } },
        overrideAccess: true,
      })
    } catch (err) {
      payload.logger.error({ err, topicId: id, collection }, '[cleanup] не удалось очистить связи удалённой темы')
    }
  }
}
