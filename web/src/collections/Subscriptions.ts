import type { Access, CollectionConfig, Where } from 'payload'

import {
  adminBranchId,
  branchGroupIds,
  isCoach,
  isFullOwner,
  isOwner,
  isParent,
} from '../access/roles'
import { stampSubscription } from '../hooks/stampSubscription'
import { MAX_PAYMENT_AMOUNT, paidRangeValid } from '../lib/paymentInput'

// Абонемент ребёнка (M8, видение v2 §3.4): запись «оплачено с/по + сумма».
// Журнальная модель: продление = НОВАЯ запись (историю оплат не переписываем),
// актуальный статус выводится из записи с максимальным paidUntil. Статусы
// (активен / заканчивается / просрочен) — вычисляются на экранах по датам,
// в БД не хранятся (нечему протухать).
//
// Деньги ЧЕРЕЗ приложение не ходят: это учётная таблица + помощник оплаты
// (реквизиты филиала на /parent/payments). Ведут владелец («бухгалтер» = owner,
// решение 2026-07-26) и админ филиала; тренер оплату не видит; родитель — своих.
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

export const readSubscriptions: Access = async ({ req }) => {
  const { user } = req
  if (!user) return false
  if (isFullOwner(user)) return true
  const branch = adminBranchId(user)
  if (branch != null) {
    const ids = await playerIdsByGroups(req, await branchGroupIds(req, branch))
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

// СОЗДАЮТ записи владелец и админ филиала (в границах филиала). Дети без группы
// тоже в скоупе админа — по player.branch (раньше они были видимы в списке, но
// запись оплаты по ним отбивалась 403).
const createSubscriptions: Access = async ({ req }) => {
  const { user } = req
  if (!user) return false
  if (isFullOwner(user)) return true
  const branch = adminBranchId(user)
  if (branch != null) {
    const ids = await playerIdsByGroups(req, await branchGroupIds(req, branch))
    const where: Where = {
      or: [...(ids.length ? [{ player: { in: ids } }] : []), { branch: { equals: branch } }],
    }
    return where
  }
  return false
}

// Правка/удаление — ТОЛЬКО владелец: журнал оплат админ филиала не переписывает
// (создать может, стереть след — нет; «кто её потом стёр» должно иметь ответ).
const ownerOnly: Access = ({ req }) => isOwner(req.user)

export const Subscriptions: CollectionConfig = {
  slug: 'subscriptions',
  labels: {
    singular: 'Абонемент',
    plural: 'Абонементы',
  },
  access: {
    create: createSubscriptions,
    delete: ownerOnly,
    read: readSubscriptions,
    update: ownerOnly,
  },
  admin: {
    defaultColumns: ['player', 'paidFrom', 'paidUntil', 'amount', 'recordedBy'],
    description:
      'Учёт оплат абонементов. Продление = новая запись; статус выводится по датам. Правка/удаление — только владелец (журнал).',
    hidden: ({ user }) => isCoach(user as unknown as { roles?: string[] | null }),
  },
  hooks: {
    // Штамп «кто записал» + денорм филиала + G211-гейт границы админа.
    beforeChange: [stampSubscription],
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
      validate: (value: unknown, { siblingData }: { siblingData: { paidFrom?: string | null } }) => {
        if (typeof value !== 'string' && !(value instanceof Date)) return true // required проверит сам
        const until = value instanceof Date ? value.toISOString() : value
        return paidRangeValid(siblingData?.paidFrom ?? null, until) || '«Оплачено с» не может быть позже «оплачено по»'
      },
    },
    {
      name: 'amount',
      type: 'number',
      label: 'Сумма, ₽',
      min: 0,
      // Потолок ловит опечатку «лишний ноль»: у цен групп/филиалов он был, у сумм — нет.
      max: MAX_PAYMENT_AMOUNT,
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
    {
      // Денорм филиала НА МОМЕНТ записи (штампует stampSubscription): перевод
      // ребёнка между группами (#111) не переписывает историю выручки филиалов.
      name: 'branch',
      type: 'relationship',
      label: 'Филиал (на момент оплаты)',
      relationTo: 'branches',
      index: true,
      admin: { readOnly: true, position: 'sidebar' },
    },
    {
      // Кто отметил оплату (штампует stampSubscription из req.user).
      name: 'recordedBy',
      type: 'relationship',
      label: 'Кто записал',
      relationTo: 'users',
      index: true,
      admin: { readOnly: true, position: 'sidebar' },
    },
  ],
  timestamps: true,
}
