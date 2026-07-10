import type { CollectionBeforeDeleteHook } from 'payload'

// Каскад при удалении РЕБЁНКА (admin-действие, хвост C3/M2): та же FK-грабля, что
// у cleanupSessionRelations — relationship Payload = ON DELETE SET NULL, а
// rsvps.player NOT NULL (required) → удаление при живых RSVP нарушает NOT NULL и
// весь DELETE откатывается. Чистим ПЕРЕД удалением (beforeDelete, не afterDelete).
//
// Также гасим login-tokens ребёнка (player nullable — DELETE не блокирует, но
// висящая join-ссылка удалённого ребёнка — мусор с зомби-приглашением).
//
// НЕ трогаем: notifications.players (hasMany → строки *_rels, каскадятся БД);
// consents.players (hasMany, тот же механизм; сама запись согласия — юр. история).
export const cleanupPlayerRelations: CollectionBeforeDeleteHook = async ({
  id,
  req: { payload },
}) => {
  for (const collection of ['rsvps', 'login-tokens'] as const) {
    try {
      await payload.delete({
        collection,
        where: { player: { equals: id } },
        overrideAccess: true,
      })
    } catch (err) {
      payload.logger.error(
        { err, playerId: id, collection },
        '[cleanup] не удалось очистить связи удаляемого ребёнка',
      )
    }
  }
}
