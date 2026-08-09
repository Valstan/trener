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
//   • login-tokens.user — nullable (не блокирует), но токены мертвы — гасим;
//   • chat-reads.user — служебные отметки прочтения, без владельца бессмысленны;
//   • match-comments.author, question-messages.author — реплики персональны,
//     уходят с аккаунтом (минимизация; догнано до модели 09.08);
//   • chat-messages: НЕ удаляем (переписка группы — общая), но АНОНИМИЗИРУЕМ
//     снимок authorName — иначе имя удалённого висит в чате навсегда.
//
// НЕ трогаем: players.parent (nullable → SET NULL сам; ребёнок остаётся в группе,
// тренер приглашает родителя заново); groups.coaches (hasMany → *_rels, каскад БД);
// legal-signatures — неизменяемый юридический журнал (152-ФЗ: факт согласия/отзыва
// должен быть доказуем и после удаления аккаунта; signer уйдёт в NULL по FK).
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
    { collection: 'chat-reads', field: 'user' },
    { collection: 'payment-threads', field: 'parent' },
    { collection: 'child-registrations', field: 'account' },
    { collection: 'match-comments', field: 'author' },
    { collection: 'question-messages', field: 'author' },
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

  // Анонимизация снимка имени в общей переписке (сообщения остаются).
  try {
    await payload.update({
      collection: 'chat-messages',
      where: { author: { equals: id } },
      data: { authorName: 'Участник удалён' },
      overrideAccess: true,
    })
  } catch (err) {
    payload.logger.error({ err, userId: id }, '[cleanup] не удалось анонимизировать chat-messages')
  }
}
