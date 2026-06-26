import type { CollectionAfterDeleteHook } from 'payload'

import type { TrainingSession } from '../payload-types'

// C3 (критик M2): удаление сессии не должно оставлять осиротевшие Notifications/Rsvps
// с «мёртвой» ссылкой session — их бы тянули inbox/coverage-запросы (PR6/PR7). Чистим
// каскадом через afterDelete. overrideAccess: служебная операция, минуя role-гейты.
//
// Каскады при удалении Player/User — реже и шире (admin-действие); задокументированы
// как хвост на потом, не входят в PR5. Best-effort: ошибка чистки логируется, не валит
// удаление сессии (она уже удалена).
export const cleanupSessionRelations: CollectionAfterDeleteHook<TrainingSession> = async ({ id, req: { payload } }) => {
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
