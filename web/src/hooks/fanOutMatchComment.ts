import type { CollectionAfterChangeHook } from 'payload'

import { buildMatchCommentMessage } from '../lib/push/message'
import { sendPushToUser } from '../lib/push/send'
import { relId } from '../lib/relId'

// Фан-аут комментария к матчу (доводка 09.08): комментарии создавались молча —
// участники узнавали о них, только открыв матч.
//
// Адресаты — границы группы (те же, что у комментария на чтение): тренеры группы,
// родители её детей и аккаунты самих детей (комментарии к матчу читают все роли).
// Push-only. R4: текст комментария и имя автора наружу не уходят.
export const fanOutMatchComment: CollectionAfterChangeHook = async ({ doc, operation, req }) => {
  if (operation !== 'create') return doc

  const { payload } = req
  const groupId = relId((doc as { group?: unknown }).group)
  if (groupId == null) return doc
  const authorId = relId((doc as { author?: unknown }).author)

  try {
    const [group, players] = await Promise.all([
      payload.findByID({ collection: 'groups', id: groupId, depth: 0, overrideAccess: true }).catch(() => null),
      payload.find({
        collection: 'players',
        where: { group: { equals: groupId } },
        depth: 0,
        limit: 1000,
        pagination: false,
        overrideAccess: true,
      }),
    ])

    const recipients = new Set<number>()
    for (const c of Array.isArray(group?.coaches) ? group.coaches : []) {
      const id = relId(c)
      if (id != null) recipients.add(Number(id))
    }
    for (const p of players.docs) {
      const parentId = relId((p as { parent?: unknown }).parent)
      if (parentId != null) recipients.add(Number(parentId))
      const accountId = relId((p as { account?: unknown }).account)
      if (accountId != null) recipients.add(Number(accountId))
    }
    if (authorId != null) recipients.delete(Number(authorId))
    if (!recipients.size) return doc

    const message = buildMatchCommentMessage()
    for (const userId of recipients) {
      await sendPushToUser(payload, userId, message).catch((pushErr) => {
        payload.logger.error({ pushErr, userId }, '[match-comment] пуш не отправлен')
      })
    }
  } catch (err) {
    payload.logger.error({ err, commentId: (doc as { id?: unknown }).id }, '[match-comment] фан-аут упал')
  }

  return doc
}
