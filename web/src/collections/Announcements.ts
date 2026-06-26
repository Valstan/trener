import type { Access, CollectionConfig, Where } from 'payload'

import { adminOrCoachOwnGroup } from '../access/byGroup'
import { coachGroupIds, isAdmin, isCoach, isParent, parentGroupIds } from '../access/roles'
import { fanOutAnnouncement } from '../hooks/fanOutAnnouncement'

// Объявление тренера группе (M3-PR10, kickoff §4). Информационный канал поверх ядра
// M2 — НЕ ack-очередь: объявления не создают Notifications и не влияют на coverage
// «N из M» (F1: ров = только изменения расписания, kickoff §1). Родитель видит ленту
// объявлений групп СВОИХ детей; тренер шлёт в свои группы. Опциональный best-effort
// `normal`-пуш по флагу `triggersPush` (granularity §6) — фан-аут afterChange.
//
// #015: write — только тренер своей группы (adminOrCoachOwnGroup, по полю group);
// read — scoped (родитель → группы его детей, тренер → свои, admin → все), плоский
// `{group:{in: ids}}`, G90-safe (overrideAccess в служебных find хелперов).
const readAnnouncements: Access = async ({ req }) => {
  const { user } = req
  if (!user) return false
  if (isAdmin(user)) return true
  if (isCoach(user)) {
    const ids = await coachGroupIds(req, user.id)
    if (!ids.length) return false
    const where: Where = { group: { in: ids } }
    return where
  }
  if (isParent(user)) {
    const ids = await parentGroupIds(req, user.id)
    if (!ids.length) return false
    const where: Where = { group: { in: ids } }
    return where
  }
  return false
}

export const Announcements: CollectionConfig = {
  slug: 'announcements',
  labels: {
    singular: 'Объявление',
    plural: 'Объявления',
  },
  access: {
    create: adminOrCoachOwnGroup,
    read: readAnnouncements,
    update: adminOrCoachOwnGroup,
    delete: adminOrCoachOwnGroup,
  },
  admin: {
    defaultColumns: ['title', 'group', 'publishedAt', 'triggersPush'],
    useAsTitle: 'title',
    description: 'Новости тренера группе. Не ack-очередь (coverage не затрагивает). Пуш — только по флагу.',
  },
  hooks: {
    afterChange: [fanOutAnnouncement],
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
      filterOptions: () => ({ roles: { in: ['admin', 'coach'] } }),
    },
    {
      name: 'group',
      type: 'relationship',
      label: 'Группа',
      relationTo: 'groups',
      required: true,
      index: true,
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
