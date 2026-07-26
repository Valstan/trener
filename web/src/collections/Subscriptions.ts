import type { Access, CollectionConfig, Where } from 'payload'

import {
  adminBranchId,
  branchGroupIds,
  coachGroupIds,
  isCoach,
  isOwner,
  isParent,
} from '../access/roles'

// Абонемент ребёнка (M8, видение v2 §3.4): запись «оплачено с/по + сумма».
// Журнальная модель: продление = НОВАЯ запись (историю оплат не переписываем),
// актуальный статус выводится из записи с максимальным paidUntil. Статусы
// (активен / заканчивается / просрочен) — вычисляются на экранах по датам,
// в БД не хранятся (нечему протухать).
//
// Деньги ЧЕРЕЗ приложение не ходят: это учётная таблица + помощник оплаты
// (реквизиты филиала на /parent/payments). Ведут владелец («бухгалтер» = owner,
// решение 2026-07-26) и админ филиала; тренер видит свои группы; родитель — своих.
// 152-ФЗ: только ребёнок+период+сумма, никаких платёжных данных родителя.

// ID детей в скоупе: филиального админа (группы филиала) или тренера (свои группы).
const playerIdsByGroups = async (
  req: Parameters<Access>[0]['req'],
  groupIds: (string | number)[],
): Promise<(string | number)[]> => {
  if (!groupIds.length) return []
  const res = await req.payload.find({
    collection: 'players',
    where: { group: { in: groupIds } },
    depth: 0,
    limit: 10000,
    pagination: false,
    overrideAccess: true,
  })
  return res.docs.map((p) => p.id)
}

const readSubscriptions: Access = async ({ req }) => {
  const { user } = req
  if (!user) return false
  if (isOwner(user)) return true
  const branch = adminBranchId(user)
  if (branch != null) {
    const ids = await playerIdsByGroups(req, await branchGroupIds(req, branch))
    if (!ids.length) return false
    const where: Where = { player: { in: ids } }
    return where
  }
  if (isCoach(user)) {
    const ids = await playerIdsByGroups(req, await coachGroupIds(req, user.id))
    if (!ids.length) return false
    const where: Where = { player: { in: ids } }
    return where
  }
  if (isParent(user)) {
    // Родитель — абонементы СВОИХ детей (плоский список id, G90-safe).
    const own = await req.payload.find({
      collection: 'players',
      where: { parent: { equals: user.id } },
      depth: 0,
      limit: 100,
      pagination: false,
      overrideAccess: true,
    })
    const ids = own.docs.map((p) => p.id)
    if (!ids.length) return false
    const where: Where = { player: { in: ids } }
    return where
  }
  return false
}

// Ведут таблицу владелец и админ филиала (в границах филиала).
const writeSubscriptions: Access = async ({ req }) => {
  const { user } = req
  if (!user) return false
  if (isOwner(user)) return true
  const branch = adminBranchId(user)
  if (branch != null) {
    const ids = await playerIdsByGroups(req, await branchGroupIds(req, branch))
    if (!ids.length) return false
    const where: Where = { player: { in: ids } }
    return where
  }
  return false
}

export const Subscriptions: CollectionConfig = {
  slug: 'subscriptions',
  labels: {
    singular: 'Абонемент',
    plural: 'Абонементы',
  },
  access: {
    create: writeSubscriptions,
    delete: writeSubscriptions,
    read: readSubscriptions,
    update: writeSubscriptions,
  },
  admin: {
    defaultColumns: ['player', 'paidFrom', 'paidUntil', 'amount'],
    description: 'Учёт оплат абонементов. Продление = новая запись; статус выводится по датам.',
  },
  fields: [
    {
      name: 'player',
      type: 'relationship',
      label: 'Ребёнок',
      relationTo: 'players',
      required: true,
      index: true,
      // ⚠️ G149-класс: required relationship = NOT NULL FK × ON DELETE SET NULL.
      // Удаление ребёнка чистит его абонементы в cleanupPlayerRelations.
    },
    {
      name: 'paidFrom',
      type: 'date',
      label: 'Оплачено с',
    },
    {
      name: 'paidUntil',
      type: 'date',
      label: 'Оплачено по',
      required: true,
      index: true,
    },
    {
      name: 'amount',
      type: 'number',
      label: 'Сумма, ₽',
      min: 0,
    },
    {
      name: 'note',
      type: 'text',
      label: 'Заметка',
      maxLength: 200,
      admin: {
        description: 'Например: «перенос из-за болезни», «скидка на второго ребёнка».',
      },
    },
  ],
  timestamps: true,
}
