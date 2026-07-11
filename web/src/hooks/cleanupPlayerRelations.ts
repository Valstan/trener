import type { CollectionBeforeDeleteHook } from 'payload'

import { relId } from '../lib/relId'

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

  // Авторы голов в матчах (`matches.scorers[].player`): FK не блокирует DELETE
  // (array-row переживёт удаление, обнулив relationship), но осталась бы строка
  // «гол забил — (пусто)». 152-ФЗ + чистая лента → вычищаем сам ребёнка из состава
  // авторов, сохраняя матч и прочих авторов. Счёт (scoreOur/Opponent) не трогаем —
  // это отдельный факт, не производная от списка.
  try {
    const affected = await payload.find({
      collection: 'matches',
      where: { 'scorers.player': { equals: id } },
      depth: 0,
      limit: 1000,
      pagination: false,
      overrideAccess: true,
    })
    for (const match of affected.docs) {
      const scorers = (match.scorers ?? []).filter((s) => relId(s.player) !== id)
      await payload.update({
        collection: 'matches',
        id: match.id,
        data: { scorers },
        overrideAccess: true,
      })
    }
  } catch (err) {
    payload.logger.error(
      { err, playerId: id },
      '[cleanup] не удалось вычистить ребёнка из авторов голов матчей',
    )
  }
}
