import type { CollectionAfterChangeHook } from 'payload'

import type { QuestionMessage } from '../payload-types'
import { buildQuestionMessage, buildQuestionReplyMessage } from '../lib/push/message'
import { sendPushToUser } from '../lib/push/send'
import { relId } from '../lib/relId'

// Фан-аут реплики в нитке чата M4 (afterChange create). Направление — по автору:
//   • тренер ответил → best-effort пуш родителю нитки (buildQuestionReplyMessage);
//   • родитель дописал → пуш тренерам группы (как fanOutQuestion у головы нитки).
// Корректность держат in-app экраны (/coach/questions и /parent/ask), пуш — сахар.
// G90: служебный find — overrideAccess. R5: try/catch, не валит создание сообщения.
// R4: payload пуша без ПДн (чистые билдеры).
export const fanOutQuestionReply: CollectionAfterChangeHook<QuestionMessage> = async ({
  doc,
  operation,
  req,
}) => {
  if (operation !== 'create') return doc

  const { payload } = req
  try {
    if (doc.authorRole === 'coach') {
      const parentId = relId(doc.parent)
      if (parentId == null) return doc
      try {
        await sendPushToUser(payload, parentId, buildQuestionReplyMessage())
        payload.logger.info(`[chat] реплика ${doc.id}: пуш родителю ${parentId}`)
      } catch (pushErr) {
        payload.logger.error({ pushErr, messageId: doc.id, parentId }, '[chat] пуш родителю не отправлен (нитка не затронута)')
      }
      return doc
    }

    // authorRole === 'parent' → тренерам группы
    const groupId = relId(doc.group)
    if (groupId == null) return doc
    const group = await payload
      .findByID({ collection: 'groups', id: groupId, depth: 0, overrideAccess: true })
      .catch(() => null)
    const coaches = Array.isArray((group as { coaches?: unknown })?.coaches)
      ? ((group as { coaches: unknown[] }).coaches.map(relId).filter((v): v is number => v != null))
      : []
    if (!coaches.length) {
      payload.logger.info(`[chat] реплика ${doc.id} группа ${groupId}: тренеров нет — пуш некому`)
      return doc
    }
    const message = buildQuestionMessage()
    let pushed = 0
    for (const coachId of coaches) {
      try {
        await sendPushToUser(payload, coachId, message)
        pushed++
      } catch (pushErr) {
        payload.logger.error({ pushErr, messageId: doc.id, coachId }, '[chat] пуш тренеру не отправлен (инбокс не затронут)')
      }
    }
    payload.logger.info(`[chat] реплика ${doc.id} группа ${groupId}: пуш ${pushed}/${coaches.length} тренерам`)
  } catch (err) {
    payload.logger.error({ err, messageId: doc.id }, '[chat] фан-аут реплики упал')
  }

  return doc
}
