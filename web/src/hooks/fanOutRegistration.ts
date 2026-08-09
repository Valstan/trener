import type { CollectionAfterChangeHook } from 'payload'

import type { ChildRegistration } from '../payload-types'
import {
  buildRegistrationDecidedMessage,
  buildRegistrationParentReviewMessage,
  buildRegistrationSubmittedMessage,
} from '../lib/push/message'
import { sendPushToUser } from '../lib/push/send'
import { relId } from '../lib/relId'

// Фан-аут детской заявки (#115 доводка): до 09.08 вся модерация была БЕЗЗВУЧНОЙ —
// владелец не знал о новой заявке, родитель — о переданной ему, ребёнок — о решении;
// связь шла «попросите родителя проверить приложение» (т.е. вне системы).
//
// Паттерн fanOutQuestion: best-effort, try/catch, не валит сохранение (R5);
// payload пуша без ПДн (R4). Адресаты по переходу статуса:
//   create (owner_review)      → владельцам сети (инбокс /coach/requests);
//   → parent_review            → назначенному родителю;
//   → accepted | rejected      → аккаунту ребёнка (устройств может не быть — ок);
//   reopen → owner_review      → владельцам (заявка вернулась на проверку).
export const fanOutRegistration: CollectionAfterChangeHook<ChildRegistration> = async ({
  doc,
  previousDoc,
  operation,
  req,
}) => {
  const { payload } = req
  const prevStatus = operation === 'create' ? null : (previousDoc?.status ?? null)
  if (prevStatus === doc.status) return doc

  try {
    if (doc.status === 'owner_review') {
      const owners = await payload.find({
        collection: 'users',
        where: { roles: { in: ['owner'] } },
        depth: 0,
        limit: 20,
        pagination: false,
        overrideAccess: true,
      })
      const message = buildRegistrationSubmittedMessage()
      for (const owner of owners.docs) {
        await sendPushToUser(payload, owner.id, message).catch(() => {})
      }
    } else if (doc.status === 'parent_review') {
      const parentId = relId(doc.proposedParent)
      if (parentId != null) {
        await sendPushToUser(payload, Number(parentId), buildRegistrationParentReviewMessage()).catch(() => {})
      }
    } else if (doc.status === 'accepted' || doc.status === 'rejected') {
      const accountId = relId(doc.account)
      if (accountId != null) {
        await sendPushToUser(payload, Number(accountId), buildRegistrationDecidedMessage(doc.status)).catch(() => {})
      }
    }
  } catch (err) {
    payload.logger.error({ err, registrationId: doc.id }, '[registration] фан-аут заявки упал')
  }

  return doc
}
