import type { CollectionAfterChangeHook } from 'payload'

import type { Match } from '../payload-types'
import { buildMatchMessage } from '../lib/push/message'
import { sendPushToUser } from '../lib/push/send'
import { relId } from '../lib/relId'

// Фан-аут матча (afterChange). До 09.08 матчи не порождали НИ ОДНОГО уведомления:
// «когда, во сколько, где» (видение §3.1) доходило до родителя, только если он сам
// заглянул в приложение.
//
// PUSH-ONLY, без Notification/ack: матч — информационный канал поверх ядра M2, как
// объявления. Ров «приняли N из M» остаётся только у изменений расписания (F1,
// kickoff §1) — иначе очередь «непринятого» размывается, и родитель перестаёт
// отличать «перенесли тренировку» от «назначили игру».
//
// События: создание матча; перенос (сменилась дата); появление счёта (итог).
// Правка соперника/места пушем не тревожит (granularity-гард, как у расписания).
const kindOf = (doc: Match, previous?: Match): 'new' | 'moved' | 'result' | null => {
  if (!previous) return 'new'
  const dateChanged = new Date(doc.matchDate).getTime() !== new Date(previous.matchDate).getTime()
  if (dateChanged) return 'moved'
  const hadScore = previous.scoreOur != null && previous.scoreOpponent != null
  const hasScore = doc.scoreOur != null && doc.scoreOpponent != null
  if (!hadScore && hasScore) return 'result'
  return null
}

export const fanOutMatchChange: CollectionAfterChangeHook<Match> = async ({
  doc,
  previousDoc,
  operation,
  req,
}) => {
  const kind = kindOf(doc, operation === 'create' ? undefined : previousDoc)
  if (!kind) return doc

  const { payload } = req
  const groupId = relId(doc.group)
  if (groupId == null) return doc

  try {
    // Родители детей группы. overrideAccess — служебное чтение (G90).
    const players = await payload.find({
      collection: 'players',
      where: { group: { equals: groupId } },
      depth: 0,
      limit: 1000,
      pagination: false,
      overrideAccess: true,
    })
    const parents = [
      ...new Set(players.docs.map((p) => relId(p.parent)).filter((v): v is number => v != null)),
    ]
    if (!parents.length) {
      payload.logger.info(`[match] матч ${doc.id} группа ${groupId}: родителей нет — пуш некому`)
      return doc
    }

    const message = buildMatchMessage(kind)
    let pushed = 0
    for (const parentId of parents) {
      try {
        await sendPushToUser(payload, parentId, message)
        pushed++
      } catch (pushErr) {
        payload.logger.error({ pushErr, matchId: doc.id, parentId }, '[match] пуш родителю не отправлен')
      }
    }
    payload.logger.info(`[match] матч ${doc.id} (${kind}): пуш ${pushed}/${parents.length} родителям`)
  } catch (err) {
    payload.logger.error({ err, matchId: doc.id }, '[match] фан-аут матча упал')
  }

  return doc
}
