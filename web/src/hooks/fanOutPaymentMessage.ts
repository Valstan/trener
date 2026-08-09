import type { CollectionAfterChangeHook } from 'payload'

import { buildPaymentMessage } from '../lib/push/message'
import { sendPushToUser } from '../lib/push/send'
import { relId } from '../lib/relId'

// Фан-аут сообщения в платёжном диалоге (доводка 09.08): раньше нить не уведомляла
// НИКОГО — родитель писал в бухгалтерию и ждал, пока туда заглянут; ответ бухгалтера
// родитель тоже не видел до следующего захода.
//
// Адресат — ВТОРАЯ сторона: реплика родителя → владелец и админ филиала нити;
// реплика бухгалтерии → родитель. Push-only, без ack. R4: ни суммы, ни текста в
// payload — только зов открыть раздел.
export const fanOutPaymentMessage: CollectionAfterChangeHook = async ({ doc, operation, req }) => {
  if (operation !== 'create') return doc

  const { payload } = req
  const threadId = relId((doc as { thread?: unknown }).thread)
  if (threadId == null) return doc
  const fromStaff = (doc as { authorRole?: string }).authorRole === 'staff'
  const authorId = relId((doc as { author?: unknown }).author)

  try {
    const thread = await payload
      .findByID({ collection: 'payment-threads', id: threadId, depth: 0, overrideAccess: true })
      .catch(() => null)
    if (!thread) return doc

    const recipients = new Set<number>()
    if (fromStaff) {
      const parentId = relId(thread.parent)
      if (parentId != null) recipients.add(Number(parentId))
    } else {
      const branchId = relId(thread.branch)
      const staff = await payload.find({
        collection: 'users',
        where: {
          or: [
            { roles: { in: ['owner'] } },
            ...(branchId != null ? [{ and: [{ roles: { in: ['admin'] } }, { branch: { equals: branchId } }] }] : []),
          ],
        },
        depth: 0,
        limit: 100,
        pagination: false,
        overrideAccess: true,
      })
      for (const u of staff.docs) recipients.add(u.id)
    }
    if (authorId != null) recipients.delete(Number(authorId))
    if (!recipients.size) return doc

    const message = buildPaymentMessage(fromStaff ? 'toParent' : 'toStaff')
    for (const userId of recipients) {
      await sendPushToUser(payload, userId, message).catch((pushErr) => {
        payload.logger.error({ pushErr, userId }, '[payment-chat] пуш не отправлен')
      })
    }
  } catch (err) {
    payload.logger.error({ err, threadId }, '[payment-chat] фан-аут упал')
  }

  return doc
}
