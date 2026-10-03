import type { CollectionAfterChangeHook } from 'payload'

import type { ChildRegistration } from '../payload-types'
import {
  buildRegistrationDecidedMessage,
  buildRegistrationParentReviewMessage,
  buildRegistrationSubmittedMessage,
} from '../lib/push/message'
import { sendPushToUser } from '../lib/push/send'
import { relId } from '../lib/relId'

// Заявка демо-тур, если демо-аккаунт (ребёнок) или предложенный родитель — демо-пользователь.
const isDemoActor = async (
  payload: Parameters<typeof sendPushToUser>[0],
  doc: ChildRegistration,
): Promise<boolean> => {
  for (const ref of [doc.account, doc.proposedParent]) {
    const id = relId(ref)
    if (id == null) continue
    const u = await payload
      .findByID({ collection: 'users', id: Number(id), depth: 0, overrideAccess: true })
      .catch(() => null)
    if (u?.demo) return true
  }
  return false
}

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
      // Демо-изоляция (D-029/#155, та же логика, что в fanOutPaymentMessage):
      // набор владельцев тут ГЛОБАЛЬНЫЙ (`roles:['owner']` без фильтра филиала/демо),
      // поэтому sendPushToUser живого владельца НЕ режет — режем у источника.
      // Заявка демо-тур → только демо-владельцам; живая заявка → только живым.
      const demo = await isDemoActor(payload, doc)
      const owners = await payload.find({
        collection: 'users',
        where: { and: [{ roles: { in: ['owner'] } }, { demo: { equals: demo } }] },
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
