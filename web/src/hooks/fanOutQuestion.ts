import type { CollectionAfterChangeHook } from 'payload'

import type { Question } from '../payload-types'
import { buildQuestionMessage } from '../lib/push/message'
import { sendPushToUser } from '../lib/push/send'
import { relId } from '../lib/relId'

// Фан-аут вопроса родителя (afterChange create). Направление ОБРАТНОЕ M2/PR10:
// адресат — тренеры группы (не родитель). Best-effort пуш каждому тренеру группы;
// корректность держит in-app инбокс /coach/questions (как очередь). НЕ влияет на
// coverage (ров — только изменения расписания).
//
// G90: служебный find группы — overrideAccess. R5: try/catch, не валит создание
// вопроса. R4: payload пуша без ПДн (buildQuestionMessage).
export const fanOutQuestion: CollectionAfterChangeHook<Question> = async ({ doc, operation, req }) => {
  if (operation !== 'create') return doc

  const { payload } = req
  const groupId = relId(doc.group)
  if (groupId == null) return doc

  try {
    const group = await payload
      .findByID({ collection: 'groups', id: groupId, depth: 0, overrideAccess: true })
      .catch(() => null)
    const coaches = Array.isArray((group as { coaches?: unknown })?.coaches)
      ? ((group as { coaches: unknown[] }).coaches.map(relId).filter((v): v is number => v != null))
      : []
    if (!coaches.length) {
      payload.logger.info(`[question] вопрос ${doc.id} группа ${groupId}: тренеров нет — пуш некому`)
      return doc
    }

    const message = buildQuestionMessage()
    let pushed = 0
    for (const coachId of coaches) {
      try {
        await sendPushToUser(payload, coachId, message)
        pushed++
      } catch (pushErr) {
        payload.logger.error({ pushErr, questionId: doc.id, coachId }, '[question] пуш тренеру не отправлен (инбокс не затронут)')
      }
    }
    payload.logger.info(`[question] вопрос ${doc.id} группа ${groupId}: пуш ${pushed}/${coaches.length} тренерам`)
  } catch (err) {
    payload.logger.error({ err, questionId: doc.id }, '[question] фан-аут вопроса упал')
  }

  return doc
}
