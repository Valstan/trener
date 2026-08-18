import type { Access, CollectionConfig, Where } from 'payload'

import { adminOrCoachOwnGroup } from '../access/byGroup'
import {
  adminBranchId,
  branchGroupIds,
  coachGroupIds,
  isFullOwner,
  isOwner,
  isCoach,
  isParent,
  parentGroupIds,
} from '../access/roles'
import { fanOutAnnouncement } from '../hooks/fanOutAnnouncement'

// Объявление тренера группе (M3-PR10) + общесетевые объявления владельца (M5 PR-C,
// docs/m5-design.md §4). Информационный канал поверх ядра M2 — НЕ ack-очередь.
//
// scope: 'group' — классика тренера; 'branch' — владелец в выбранные филиалы
// (поле branches); 'network' — владелец во всю сеть. Не-group создаёт только
// owner (гейт в guardScope — beforeValidate, работает и под overrideAccess).
//
// #015: write — только тренер своей группы (adminOrCoachOwnGroup) или owner;
// read — scoped: свои группы + сетевые + филиальные своего филиала. Филиал
// пользователя берём из users.branch (JWT), без лишних find (G90-safe).
const readAnnouncements: Access = async ({ req }) => {
  const { user } = req
  if (!user) return false
  if (isFullOwner(user)) return true

  // Филиал пользователя — для видимости branch-объявлений.
  const userBranch = (user as { branch?: { id: number } | number | null }).branch
  const userBranchId = typeof userBranch === 'object' && userBranch !== null ? userBranch.id : userBranch

  const wide: Where[] = [{ scope: { equals: 'network' } }]
  if (userBranchId != null) {
    wide.push({ and: [{ scope: { equals: 'branch' } }, { branches: { in: [userBranchId] } }] })
  }

  // Админ филиала — контент групп своего филиала (M5).
  const branch = adminBranchId(user)
  if (branch != null) {
    const ids = await branchGroupIds(req, branch)
    return { or: [...wide, ...(ids.length ? [{ group: { in: ids } } as Where] : [])] }
  }
  if (isCoach(user)) {
    const ids = await coachGroupIds(req, user.id)
    return { or: [...wide, ...(ids.length ? [{ group: { in: ids } } as Where] : [])] }
  }
  if (isParent(user)) {
    const ids = await parentGroupIds(req, user.id)
    return { or: [...wide, ...(ids.length ? [{ group: { in: ids } } as Where] : [])] }
  }
  return false
}

// Write: owner — всё; тренер/админ — только групповые своих групп (по полю group).
const writeAnnouncements: Access = async (args) => {
  const { req } = args
  if (isOwner(req.user)) return true
  // Тренер/админ не трогают сетевые/филиальные — только scope=group.
  const base = await adminOrCoachOwnGroup(args)
  if (base === true || base === false) return base
  return { and: [{ scope: { equals: 'group' } }, base] }
}

export const Announcements: CollectionConfig = {
  slug: 'announcements',
  labels: {
    singular: 'Объявление',
    plural: 'Объявления',
  },
  access: {
    create: writeAnnouncements,
    read: readAnnouncements,
    update: writeAnnouncements,
    delete: writeAnnouncements,
  },
  admin: {
    defaultColumns: ['title', 'scope', 'group', 'publishedAt', 'triggersPush'],
    useAsTitle: 'title',
    description: 'Новости тренера группе / владельца сети. Не ack-очередь. Пуш — только по флагу.',
  },
  hooks: {
    afterChange: [fanOutAnnouncement],
    beforeValidate: [
      // Гейт охвата (M5): scope≠group и pinned может выставить только владелец.
      // beforeValidate работает и на server-mediated путях с overrideAccess.
      async ({ data, req }) => {
        if (!data) return data
        const scope = data.scope ?? 'group'
        if ((scope !== 'group' || data.pinned) && !isOwner(req?.user)) {
          throw new Error('Сетевые/филиальные и закреплённые объявления создаёт только владелец')
        }
        if (scope === 'group' && data.group == null) {
          throw new Error('Групповому объявлению нужна группа')
        }
        if (scope === 'branch' && !(Array.isArray(data.branches) && data.branches.length)) {
          throw new Error('Филиальному объявлению нужен список филиалов')
        }
        return data
      },
    ],
  },
  fields: [
    {
      name: 'author',
      type: 'relationship',
      label: 'Автор',
      relationTo: 'users',
      // Автор = текущий пользователь на создании (тренер). Не из клиента.
      defaultValue: ({ req }) => req?.user?.id,
      admin: { readOnly: true, position: 'sidebar' },
      filterOptions: () => ({ roles: { in: ['owner', 'admin', 'coach'] } }),
    },
    // ── M5 PR-C: охват объявления ──
    {
      name: 'scope',
      type: 'select',
      label: 'Охват',
      required: true,
      defaultValue: 'group',
      index: true,
      options: [
        { label: 'Группа', value: 'group' },
        { label: 'Выбранные филиалы', value: 'branch' },
        { label: 'Вся сеть', value: 'network' },
      ],
      admin: {
        description: 'Филиалы/сеть — только владелец. Группа — классическое объявление тренера.',
      },
    },
    {
      name: 'branches',
      type: 'relationship',
      label: 'Филиалы',
      relationTo: 'branches',
      hasMany: true,
      admin: {
        condition: (data) => data?.scope === 'branch',
        description: 'Кому адресовано при охвате «Выбранные филиалы».',
      },
    },
    {
      name: 'pinned',
      type: 'checkbox',
      label: 'Закрепить (баннер)',
      defaultValue: false,
      admin: {
        description: 'Закреплённое объявление показывается сверху ленты. Только владелец.',
      },
    },
    {
      name: 'group',
      type: 'relationship',
      label: 'Группа',
      relationTo: 'groups',
      // required снят в M5: у branch/network объявлений группы нет (валидация —
      // в guardScope beforeValidate). НЕ required в схеме — иначе FK-грабля G149.
      index: true,
      admin: {
        condition: (data) => (data?.scope ?? 'group') === 'group',
      },
    },
    {
      name: 'title',
      type: 'text',
      label: 'Заголовок',
      required: true,
      maxLength: 140,
    },
    {
      name: 'body',
      type: 'textarea',
      label: 'Текст',
      required: true,
      maxLength: 2000,
      admin: {
        description: '152-ФЗ: массовая рассылка — без персональных данных детей в тексте.',
      },
    },
    {
      name: 'triggersPush',
      type: 'checkbox',
      label: 'Уведомить пушем',
      defaultValue: false,
      admin: {
        description: 'best-effort, normal-приоритет. Пуш уходит ОДИН раз — на создании (granularity §6).',
      },
    },
    {
      name: 'publishedAt',
      type: 'date',
      label: 'Опубликовано',
      defaultValue: () => new Date().toISOString(),
      index: true,
      admin: { readOnly: true, position: 'sidebar' },
    },
  ],
  timestamps: true,
}
