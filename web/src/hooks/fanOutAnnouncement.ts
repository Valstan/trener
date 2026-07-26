import type { CollectionAfterChangeHook } from 'payload'

import type { Announcement } from '../payload-types'
import { buildAnnouncementMessage } from '../lib/push/message'
import { sendPushToUser } from '../lib/push/send'
import { relId } from '../lib/relId'

// Фан-аут объявления (afterChange). В ОТЛИЧИЕ от фан-аута расписания (M2) НЕ создаёт
// Notifications и НЕ влияет на coverage «N из M»: ров — только изменения расписания
// (F1, kickoff §1). Объявление живёт лентой на /parent; здесь — только best-effort
// пуш-ускоритель поверх, и ТОЛЬКО когда автор явно попросил (`triggersPush`).
//
// M5 PR-C: охваты. scope=group — родители группы (как в M3); scope=branch —
// родители детей всех групп выбранных филиалов; scope=network — всей сети.
// Владелец шлёт такое осознанно → granularity-правило (kickoff §6) соблюдено:
// пуш только на create и только по флагу, normal-приоритет.
//
// Best-effort (R5): обёрнуто в try/catch, не валит сохранение. G90: служебные find —
// overrideAccess. 152-ФЗ R4: payload пуша без ПДн (buildAnnouncementMessage).
export const fanOutAnnouncement: CollectionAfterChangeHook<Announcement> = async ({ doc, operation, req }) => {
  if (operation !== 'create') return doc // правка/republish не шлёт пуш повторно
  if (!doc.triggersPush) return doc // автор не просил пуш — только лента

  const { payload } = req
  const scope = doc.scope ?? 'group'

  try {
    // Группы-адресаты по охвату.
    let groupIds: number[] = []
    if (scope === 'group') {
      const groupId = relId(doc.group)
      if (groupId == null) return doc
      groupIds = [groupId]
    } else {
      const branchIds =
        scope === 'branch'
          ? (doc.branches ?? []).map((b) => relId(b)).filter((v): v is number => v != null)
          : null // network — все филиалы
      const groups = await payload.find({
        collection: 'groups',
        where: branchIds ? { branch: { in: branchIds } } : {},
        depth: 0,
        limit: 1000,
        pagination: false,
        overrideAccess: true,
      })
      groupIds = groups.docs.map((g) => g.id)
      if (!groupIds.length) return doc
    }

    // Родители-адресаты = родители детей затронутых групп. overrideAccess (G90).
    const players = await payload.find({
      collection: 'players',
      where: { group: { in: groupIds } },
      depth: 0,
      limit: 10000,
      pagination: false,
      overrideAccess: true,
    })

    const parentIds = new Set<number>()
    for (const p of players.docs) {
      const parentId = relId((p as { parent?: unknown }).parent)
      if (parentId != null) parentIds.add(parentId)
    }

    const message = buildAnnouncementMessage()
    let pushed = 0
    for (const parentId of parentIds) {
      try {
        await sendPushToUser(payload, parentId, message)
        pushed++
      } catch (pushErr) {
        payload.logger.error({ pushErr, announcementId: doc.id, parentId }, '[announce] пуш не отправлен (лента не затронута)')
      }
    }

    payload.logger.info(
      `[announce] объявление ${doc.id} (${scope}, групп: ${groupIds.length}): пуш ${pushed}/${parentIds.size} родителям`,
    )
  } catch (err) {
    payload.logger.error({ err, announcementId: doc.id }, '[announce] фан-аут объявления упал')
  }

  return doc
}
