import type { CollectionBeforeDeleteHook } from 'payload'

// C3 (критик M2): удаление сессии не должно оставлять осиротевшие Notifications/Rsvps
// с «мёртвой» ссылкой session — их бы тянули inbox/coverage-запросы (PR6/PR7).
//
// ⚠️ Именно beforeDelete, НЕ afterDelete: FK Payload на relationship = ON DELETE SET
// NULL, а notifications.session / rsvps.session — NOT NULL (поле required). Удаление
// сессии при живых детях → БД пытается занулить session_id → нарушает NOT NULL → весь
// DELETE откатывается. Поэтому чистим детей ПЕРЕД удалением родителя (afterDelete
// сработал бы слишком поздно — строки уже бы блокировали удаление).
// overrideAccess: служебная операция, минуя role-гейты.
//
// Каскады при удалении Player/User — реже и шире (admin-действие); та же FK-грабля,
// задокументированы как хвост на потом, не входят в PR5.
export const cleanupSessionRelations: CollectionBeforeDeleteHook = async ({ id, req: { payload } }) => {
  for (const collection of ['notifications', 'rsvps'] as const) {
    try {
      await payload.delete({
        collection,
        where: { session: { equals: id } },
        overrideAccess: true,
      })
    } catch (err) {
      payload.logger.error({ err, sessionId: id, collection }, '[cleanup] не удалось очистить связи удалённой сессии')
    }
  }
}
