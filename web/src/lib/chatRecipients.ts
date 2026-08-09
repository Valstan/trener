import type { Payload } from 'payload'

import { relId } from './relId'

// Кому уходит пуш о новом сообщении чата — по СКОУПУ и КОМНАТЕ темы.
//
// Две дыры, которые это закрывает (аудит 09.08):
//   • branch/school-темы не пушили НИКОМУ: фан-аут выходил на `group == null`,
//     то есть общешкольный чат был беззвучным;
//   • детская комната пушила РОДИТЕЛЯМ (комната им закрыта на чтение — открыв
//     приложение, они не находили ничего нового), а сами дети не получали пуш
//     никогда: в адресатах учитывался только player.parent.
//
// Возвращает id пользователей; автора исключает вызывающий.
export type TopicScope = 'group' | 'branch' | 'school'
export type TopicRoom = 'adults' | 'children'

export const chatRecipients = async (
  payload: Payload,
  topic: { scope?: TopicScope | null; room?: TopicRoom | null; group?: unknown; branch?: unknown },
): Promise<number[]> => {
  const scope: TopicScope = topic.scope ?? 'group'
  const room: TopicRoom = topic.room ?? 'adults'
  const recipients = new Set<number>()

  // Детская комната существует только у групповых тем (parseTopicCreate это
  // гарантирует): адресаты — аккаунты детей группы + тренеры (модерация).
  if (room === 'children') {
    const groupId = relId(topic.group)
    if (groupId == null) return []
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
    for (const p of players.docs) {
      const accountId = relId((p as { account?: unknown }).account)
      if (accountId != null) recipients.add(Number(accountId))
    }
    for (const c of Array.isArray(group?.coaches) ? group.coaches : []) {
      const id = relId(c)
      if (id != null) recipients.add(Number(id))
    }
    return [...recipients]
  }

  // Взрослая комната: набор групп зависит от скоупа.
  let groupIds: number[] = []
  if (scope === 'group') {
    const groupId = relId(topic.group)
    if (groupId == null) return []
    groupIds = [Number(groupId)]
  } else if (scope === 'branch') {
    const branchId = relId(topic.branch)
    if (branchId == null) return []
    const groups = await payload.find({
      collection: 'groups',
      where: { branch: { equals: branchId } },
      depth: 0,
      limit: 1000,
      pagination: false,
      overrideAccess: true,
    })
    groupIds = groups.docs.map((g) => g.id)
    // Персонал филиала (админы/тренеры с этим филиалом) — тоже участники.
    const staff = await payload.find({
      collection: 'users',
      where: { and: [{ branch: { equals: branchId } }, { roles: { in: ['admin', 'coach'] } }] },
      depth: 0,
      limit: 500,
      pagination: false,
      overrideAccess: true,
    })
    for (const u of staff.docs) recipients.add(u.id)
  } else {
    // school: все подтверждённые взрослые сети (родители и персонал).
    const users = await payload.find({
      collection: 'users',
      where: { and: [{ status: { equals: 'approved' } }, { roles: { in: ['owner', 'admin', 'coach', 'parent'] } }] },
      depth: 0,
      limit: 5000,
      pagination: false,
      overrideAccess: true,
    })
    for (const u of users.docs) recipients.add(u.id)
    return [...recipients]
  }

  if (groupIds.length) {
    const [groups, players] = await Promise.all([
      payload.find({
        collection: 'groups',
        where: { id: { in: groupIds } },
        depth: 0,
        limit: 1000,
        pagination: false,
        overrideAccess: true,
      }),
      payload.find({
        collection: 'players',
        where: { group: { in: groupIds } },
        depth: 0,
        limit: 5000,
        pagination: false,
        overrideAccess: true,
      }),
    ])
    for (const g of groups.docs) {
      for (const c of Array.isArray(g.coaches) ? g.coaches : []) {
        const id = relId(c)
        if (id != null) recipients.add(Number(id))
      }
    }
    for (const p of players.docs) {
      const id = relId((p as { parent?: unknown }).parent)
      if (id != null) recipients.add(Number(id))
    }
  }

  return [...recipients]
}
