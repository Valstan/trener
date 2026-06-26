import type { CollectionAfterChangeHook } from 'payload'

import type { TrainingSession } from '../payload-types'
import { SCHEDULE_WAVE_CONTEXT_KEY, type ScheduleChangeWave } from './trackSessionChange'

// id из relationship-поля при depth:0 — это число; объект — на случай заполненной связи.
const relId = (v: unknown): number | null => {
  if (v == null) return null
  if (typeof v === 'number') return v
  if (typeof v === 'object' && 'id' in v && typeof (v as { id: unknown }).id === 'number') {
    return (v as { id: number }).id
  }
  return null
}

// Фан-аут уведомлений (afterChange). ЯДРО КОРРЕКТНОСТИ M2: при значимой правке
// (волна поднята trackSessionChange) создаёт по одному Notification на каждого
// родителя затронутой группы и помечает непринятые уведомления прошлых волн как
// superseded. НЕ зависит от пуша — это in-app очередь, первичный гарант доведения.
//
// H4: одно уведомление = (session × parent) за волну, дети родителя сгруппированы в
// players[] (семья с двумя детьми акает один раз). C2: changedAt — снимок волны,
// coverage сверяет его с session.changedAt. G90: все find/create — overrideAccess.
//
// Best-effort на уровне операции (R5): фан-аут обёрнут в try/catch и НЕ валит
// сохранение сессии (она уже записана). Но сбой логируется громко — coverage покажет
// «0 из M принявших», что вскроет проблему тренеру, а не молчит.
export const fanOutScheduleChange: CollectionAfterChangeHook<TrainingSession> = async ({ doc, req }) => {
  const ctx = req.context as Record<string, unknown>
  const wave = ctx[SCHEDULE_WAVE_CONTEXT_KEY] as ScheduleChangeWave | undefined
  if (!wave) return doc // незначимая правка / создание — фан-аута нет

  const { payload } = req
  const sessionId = doc.id
  const groupId = relId(doc.group)
  if (groupId == null) return doc

  try {
    // Все дети затронутой группы → их родители-адресаты. overrideAccess (G90).
    const players = await payload.find({
      collection: 'players',
      where: { group: { equals: groupId } },
      depth: 0,
      limit: 1000,
      pagination: false,
      overrideAccess: true,
    })

    // H4: группируем детей по родителю (одно уведомление на семью).
    const byParent = new Map<number, number[]>()
    let orphan = 0
    for (const p of players.docs) {
      const parentId = relId((p as { parent?: unknown }).parent)
      if (parentId == null) {
        orphan++ // ребёнок ещё не привязан к родителю — некому слать (видно в coverage, PR7)
        continue
      }
      const list = byParent.get(parentId) ?? []
      list.push(p.id)
      byParent.set(parentId, list)
    }

    // C2: непринятые уведомления ПРОШЛЫХ волн этой сессии → superseded. Делаем ДО
    // создания новых; current-волну защищает changedAt != wave.changedAt. acked/
    // superseded не трогаем (история). Coverage считает только текущую волну.
    await payload.update({
      collection: 'notifications',
      where: {
        and: [
          { session: { equals: sessionId } },
          { status: { in: ['delivered', 'seen'] } },
          { changedAt: { not_equals: wave.changedAt } },
        ],
      },
      data: { status: 'superseded' },
      overrideAccess: true,
    })

    let created = 0
    for (const [parentId, playerIds] of byParent) {
      try {
        await payload.create({
          collection: 'notifications',
          data: {
            session: sessionId,
            parent: parentId,
            players: playerIds,
            type: wave.type,
            status: 'delivered',
            changedAt: wave.changedAt,
          },
          overrideAccess: true,
        })
        created++
      } catch (err) {
        payload.logger.error({ err, sessionId, parentId }, '[fanout] не удалось создать уведомление родителю')
      }
    }

    payload.logger.info(
      `[fanout] session ${sessionId} волна ${wave.type}@${wave.changedAt}: создано ${created}, детей без родителя ${orphan}`,
    )
  } catch (err) {
    payload.logger.error({ err, sessionId }, '[fanout] фан-аут уведомлений упал')
  }

  return doc
}
