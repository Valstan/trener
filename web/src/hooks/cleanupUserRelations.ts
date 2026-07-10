import type { CollectionBeforeDeleteHook } from 'payload'

// Каскад при удалении ПОЛЬЗОВАТЕЛЯ (admin-действие; право на удаление аккаунта —
// 152-ФЗ). FK-грабля как у cleanupSessionRelations: relationship = ON DELETE SET
// NULL, а поля required (NOT NULL) → DELETE блокируется. Чистим перед удалением:
//
//   • rsvps.parent, notifications.parent — персональная очередь/ответы уходят
//     вместе с аккаунтом (минимизация: история чужой очереди никому не нужна);
//   • devices.user — push-подписки мертвы без владельца;
//   • questions.parent — переписка «вопрос тренеру» персональна;
//   • consents.parent — цифровая ЗАПИСЬ согласия удаляется с аккаунтом
//     (источник юридической истины — бумажное согласие, kickoff §5; удаление
//     аккаунта = отзыв, факт логируем);
//   • login-tokens.user — nullable (не блокирует), но токены мертвы — гасим.
//
// НЕ трогаем: players.parent (nullable → SET NULL сам; ребёнок остаётся в группе,
// тренер приглашает родителя заново); groups.coaches (hasMany → *_rels, каскад БД).
export const cleanupUserRelations: CollectionBeforeDeleteHook = async ({
  id,
  req: { payload },
}) => {
  const targets = [
    { collection: 'rsvps', field: 'parent' },
    { collection: 'notifications', field: 'parent' },
    { collection: 'devices', field: 'user' },
    { collection: 'questions', field: 'parent' },
    { collection: 'consents', field: 'parent' },
    { collection: 'login-tokens', field: 'user' },
  ] as const

  for (const { collection, field } of targets) {
    try {
      if (collection === 'consents') {
        payload.logger.info(
          { userId: id },
          '[cleanup] удаление аккаунта: цифровые записи согласий удаляются (бумага — источник истины)',
        )
      }
      await payload.delete({
        collection,
        where: { [field]: { equals: id } },
        overrideAccess: true,
      })
    } catch (err) {
      payload.logger.error(
        { err, userId: id, collection },
        '[cleanup] не удалось очистить связи удаляемого пользователя',
      )
    }
  }
}
