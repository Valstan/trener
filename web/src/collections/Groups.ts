import type { Access, CollectionConfig, Where } from 'payload'

import {
  adminBranchId,
  branchGroupIds,
  coachGroupIds,
  isCoach,
  isDemo,
  isFullOwner,
  isParent,
  parentGroupIds,
} from '../access/roles'
import { demoGuestLimit } from '../hooks/demoGuestLimit'

// Группа (команда) детской футбольной школы: имя + филиал + тренер(ы) + состав
// (Players). Филиал группы — ось многофилиальности M5: весь групповой контент
// наследует филиал через это поле (docs/m5-design.md §0).
const readGroups: Access = async ({ req }) => {
  const { user } = req
  if (!user) return false
  // Зеркало изоляции D-029 (Branches.read): демо видит только группы демо-филиала,
  // живым исключать нечего вручную — их скоупы (свои группы/дети) в демо-филиал не
  // указывают. Плоский список id — критик M2 H2 (не вложенный relationship-where).
  if (isDemo(user)) {
    const demoBranch = (user as { branch?: { id: number } | number | null }).branch
    const demoBranchId = typeof demoBranch === 'object' && demoBranch !== null ? demoBranch.id : demoBranch
    if (demoBranchId == null) return false
    const ids = await branchGroupIds(req, demoBranchId)
    return ids.length ? { id: { in: ids } } : false
  }
  if (isFullOwner(user)) return true
  const branch = adminBranchId(user)
  if (branch != null) {
    const where: Where = { branch: { equals: branch } }
    return where
  }
  if (isCoach(user)) {
    const ids = await coachGroupIds(req, user.id)
    if (!ids.length) return false
    const where: Where = { id: { in: ids } }
    return where
  }
  if (isParent(user)) {
    const ids = await parentGroupIds(req, user.id)
    if (!ids.length) return false
    return { id: { in: ids } }
  }
  return false
}

// Тренер правит только свои группы; владелец — все; админ — группы своего филиала.
const updateGroups: Access = ({ req: { user } }) => {
  if (!user) return false
  if (isFullOwner(user)) return true
  const branch = adminBranchId(user)
  if (branch != null) {
    const where: Where = { branch: { equals: branch } }
    return where
  }
  if (isCoach(user)) {
    const where: Where = { coaches: { in: [user.id] } }
    return where
  }
  return false
}

// Создание/удаление групп: владелец — где угодно; админ — только в своём филиале
// (на create сверяем присланный branch — id или объект; fail-closed).
const createGroups: Access = ({ req: { user }, data }) => {
  if (!user) return false
  if (isFullOwner(user)) return true
  const branch = adminBranchId(user)
  if (branch == null) return false
  const target = data?.branch
  const targetId = typeof target === 'object' && target !== null ? target.id : target
  return targetId != null && String(targetId) === String(branch)
}

const deleteGroups: Access = ({ req: { user } }) => {
  if (!user) return false
  if (isFullOwner(user)) return true
  const branch = adminBranchId(user)
  if (branch != null) {
    const where: Where = { branch: { equals: branch } }
    return where
  }
  return false
}

export const Groups: CollectionConfig = {
  slug: 'groups',
  labels: {
    singular: 'Группа',
    plural: 'Группы',
  },
  access: {
    create: createGroups,
    delete: deleteGroups,
    read: readGroups,
    update: updateGroups,
  },
  admin: {
    defaultColumns: ['name', 'branch', 'coaches'],
    useAsTitle: 'name',
  },
  hooks: {
    beforeChange: [demoGuestLimit],
  },
  fields: [
    // D-029: лимит 5 сущностей на демо-посетителя. Ставится ТОЛЬКО хуком
    // demoGuestLimit (field-access режет только клиентский ввод).
    {
      name: 'demoGuest',
      type: 'checkbox',
      defaultValue: false,
      admin: { hidden: true },
      access: { create: () => false, update: () => false },
    },
    {
      name: 'name',
      type: 'text',
      label: 'Название группы',
      required: true,
      maxLength: 120,
    },
    {
      name: 'coaches',
      type: 'relationship',
      label: 'Тренеры',
      relationTo: 'users',
      hasMany: true,
      // Только пользователи с ролью «тренер» доступны в выборе.
      filterOptions: () => ({ roles: { in: ['coach'] } }),
      admin: {
        description: 'Кто ведёт группу. Тренер видит и правит только свои группы.',
      },
    },
    {
      name: 'description',
      type: 'textarea',
      label: 'Описание',
      maxLength: 500,
    },
    {
      name: 'branch',
      type: 'relationship',
      label: 'Филиал',
      relationTo: 'branches',
      required: true,
      admin: {
        description: 'Филиал группы. Определяет, кто вообще видит её расписание, объявления и детей.',
      },
    },
    {
      name: 'monthlyFee',
      type: 'number',
      label: 'Абонемент на месяц, ₽',
      min: 0,
      max: 1000000,
      admin: {
        description:
          'Цена именно этой группы. Пусто — берётся цена филиала. Родитель видит её как «к оплате».',
      },
    },
  ],
  timestamps: true,
}
