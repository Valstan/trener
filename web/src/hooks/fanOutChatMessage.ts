import type { CollectionAfterChangeHook } from 'payload'

import type { ChatMessage } from '../payload-types'
import { chatRecipients } from '../lib/chatRecipients'
import { buildChatMessage } from '../lib/push/message'
import { sendPushToUser } from '../lib/push/send'
import { relId } from '../lib/relId'

// Фан-аут сообщения в комнате (M9, доводка скоупов 09.08). Адресаты считаются по
// СКОУПУ и КОМНАТЕ темы (см. lib/chatRecipients): раньше хук выходил при пустой
// группе — темы филиала и всей школы были беззвучными, а детская комната пушила
// родителям (которым она закрыта) вместо самих детей.
//
// Как и объявление, НЕ создаёт Notifications и НЕ влияет на coverage «N из M»:
// ров — только изменения расписания (kickoff §1). Пуш здесь — ускоритель поверх
// in-app списка тем.
//
// Best-effort (R5): try/catch, не валит сохранение сообщения. G90: служебные find —
// overrideAccess. 152-ФЗ R4: payload пуша без ПДн (buildChatMessage) — в реплике
// родителя запросто окажется имя ребёнка, поэтому наружу не уходит ни текст, ни тема.
export const fanOutChatMessage: CollectionAfterChangeHook<ChatMessage> = async ({ doc, operation, req }) => {
  if (operation !== 'create') return doc

  const { payload } = req
  const authorId = relId(doc.author)

  try {
    const ids = await chatRecipients(payload, {
      scope: doc.scope ?? 'group',
      room: doc.room ?? 'adults',
      group: doc.group,
      branch: doc.branch,
    })
    const recipients = new Set(ids)
    // Автору собственное сообщение не шлём.
    if (authorId != null) recipients.delete(Number(authorId))

    if (!recipients.size) {
      payload.logger.info(`[chat] сообщение ${doc.id} (${doc.scope}/${doc.room}): адресатов нет`)
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

    payload.logger.info(
      `[chat] сообщение ${doc.id} (${doc.scope}/${doc.room}): пуш ${pushed}/${recipients.size} участникам`,
    )
  } catch (err) {
    payload.logger.error({ err, messageId: doc.id }, '[chat] фан-аут сообщения упал')
  }

  return doc
}
