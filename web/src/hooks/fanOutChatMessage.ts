import type { CollectionAfterChangeHook } from 'payload'

import type { ChatMessage } from '../payload-types'
import { buildChatMessage } from '../lib/push/message'
import { sendPushToUser } from '../lib/push/send'
import { relId } from '../lib/relId'

// Фан-аут сообщения в комнате (M9). Адресаты — остальные участники группы: тренеры
// группы + родители её детей, кроме автора. Как и объявление, НЕ создаёт Notifications
// и НЕ влияет на coverage «N из M»: ров — только изменения расписания (kickoff §1).
//
// Пуш здесь — ускоритель поверх in-app списка тем, а не гарантия: не дошёл — родитель
// увидит непрочитанное, когда откроет приложение.
//
// Best-effort (R5): try/catch, не валит сохранение сообщения. G90: служебные find —
// overrideAccess. 152-ФЗ R4: payload пуша без ПДн (buildChatMessage) — в реплике
// родителя запросто окажется имя ребёнка, поэтому наружу не уходит ни текст, ни тема.
export const fanOutChatMessage: CollectionAfterChangeHook<ChatMessage> = async ({ doc, operation, req }) => {
  if (operation !== 'create') return doc

  const { payload } = req
  const groupId = relId(doc.group)
  if (groupId == null) return doc
  const authorId = relId(doc.author)

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
      if (id != null) recipients.add(id)
    }
    for (const p of players.docs) {
      const id = relId((p as { parent?: unknown }).parent)
      if (id != null) recipients.add(id)
    }
    // Автору собственное сообщение не шлём.
    if (authorId != null) recipients.delete(authorId)

    if (!recipients.size) {
      payload.logger.info(`[chat] сообщение ${doc.id} группа ${groupId}: адресатов нет`)
      return doc
    }

    const message = buildChatMessage()
    let pushed = 0
    for (const userId of recipients) {
      try {
        await sendPushToUser(payload, userId, message)
        pushed++
      } catch (pushErr) {
        payload.logger.error({ pushErr, messageId: doc.id, userId }, '[chat] пуш не отправлен (лента не затронута)')
      }
    }

    payload.logger.info(`[chat] сообщение ${doc.id} группа ${groupId}: пуш ${pushed}/${recipients.size} участникам`)
  } catch (err) {
    payload.logger.error({ err, messageId: doc.id }, '[chat] фан-аут сообщения упал')
  }

  return doc
}
