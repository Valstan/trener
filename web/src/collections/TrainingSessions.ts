import type { Access, CollectionConfig } from 'payload'

import { adminOrCoachOwnGroup } from '../access/byGroup'
import { coachGroupIds, hasRole, isAdmin, isCoach, isParent, parentGroupIds } from '../access/roles'

// Тренировка (запись расписания). ← Sabantuy Events.ts + поле `status`.
//
// `status` драйвит атомарный сценарий M2: planned → changed|cancelled создаёт
// Notification всем затронутым родителям → high-priority пуш → сбор ack → coverage.
//
// #015: тренер видит/правит только сессии своих групп; родитель — только расписание
// групп своих детей.
const readSessions: Access = async ({ req }) => {
  const { user } = req
  if (!user) return false
  if (isAdmin(user)) return true
  if (isCoach(user)) {
    const ids = await coachGroupIds(req, user.id)
    if (!ids.length) return false
    return { group: { in: ids } }
  }
  if (isParent(user)) {
    const ids = await parentGroupIds(req, user.id)
    if (!ids.length) return false
    return { group: { in: ids } }
  }
  return false
}

export const TrainingSessions: CollectionConfig = {
  slug: 'training-sessions',
  labels: {
    singular: 'Тренировка',
    plural: 'Расписание',
  },
  access: {
    create: ({ req: { user } }) => hasRole(user, 'admin', 'coach'),
    read: readSessions,
    update: adminOrCoachOwnGroup,
    delete: adminOrCoachOwnGroup,
  },
  admin: {
    defaultColumns: ['group', 'startDate', 'status', 'location'],
    useAsTitle: 'startDate',
  },
  fields: [
    {
      name: 'group',
      type: 'relationship',
      label: 'Группа',
      relationTo: 'groups',
      required: true,
    },
    {
      name: 'startDate',
      type: 'date',
      label: 'Начало',
      required: true,
      admin: {
        date: { pickerAppearance: 'dayAndTime' },
      },
    },
    {
      name: 'endDate',
      type: 'date',
      label: 'Окончание',
      admin: {
        date: { pickerAppearance: 'dayAndTime' },
      },
    },
    {
      name: 'location',
      type: 'text',
      label: 'Место проведения',
      maxLength: 200,
    },
    {
      name: 'status',
      type: 'select',
      label: 'Статус',
      required: true,
      defaultValue: 'planned',
      options: [
        { label: 'Запланирована', value: 'planned' },
        { label: 'Изменена', value: 'changed' },
        { label: 'Отменена', value: 'cancelled' },
      ],
      admin: {
        position: 'sidebar',
        description: 'Изменение/отмена запускает уведомление родителям (этап M2).',
      },
    },
    {
      name: 'note',
      type: 'textarea',
      label: 'Заметка тренера',
      maxLength: 500,
    },
  ],
  timestamps: true,
}
