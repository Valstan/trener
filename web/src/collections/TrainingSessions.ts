import type { Access, CollectionConfig } from 'payload'

import { adminOrCoachOwnGroup } from '../access/byGroup'
import {
  adminOrStaffField,
  coachGroupIds,
  hasRole,
  isAdmin,
  isCoach,
  isParent,
  parentGroupIds,
} from '../access/roles'
import { cleanupSessionRelations } from '../hooks/cleanupSessionRelations'
import { fanOutScheduleChange } from '../hooks/fanOutScheduleChange'
import { revalidateSchedule, revalidateScheduleDelete } from '../hooks/revalidateSchedule'
import { trackSessionChange } from '../hooks/trackSessionChange'

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
  // M2-ядро: diff-трекинг правки (beforeChange) → фан-аут уведомлений + ISR
  // (afterChange) → каскадная чистка связей при удалении (afterDelete).
  // Подробности и решения критика — docs/m2-core-design.md.
  hooks: {
    beforeChange: [trackSessionChange],
    afterChange: [fanOutScheduleChange, revalidateSchedule],
    afterDelete: [cleanupSessionRelations, revalidateScheduleDelete],
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
    // ─── Diff-трекинг изменения (заполняет хук trackSessionChange, PR5) ──────────
    // Служебные поля: фиксируют ЧТО и КОГДА реально изменилось, чтобы фан-аут
    // сработал только на значимую правку (granularity-гард, kickoff §6) и чтобы
    // показать родителю «перенос с X на Y». read field-locked на staff — родителю
    // diff отдаёт inbox-эндпоинт (PR6) уже готовым текстом (152-ФЗ: минимизация).
    {
      name: 'changedFields',
      type: 'json',
      label: 'Изменённые поля',
      access: { read: adminOrStaffField },
      admin: {
        readOnly: true,
        position: 'sidebar',
        description: 'Список реально изменившихся полей последней волны (служебное).',
      },
    },
    {
      name: 'changedAt',
      type: 'date',
      label: 'Изменено в (волна)',
      index: true,
      access: { read: adminOrStaffField },
      admin: {
        readOnly: true,
        position: 'sidebar',
        description: 'Метка последней значимой правки. Coverage и снимок в Notifications.changedAt.',
      },
    },
    {
      name: 'prevStartDate',
      type: 'date',
      label: 'Прежнее начало',
      access: { read: adminOrStaffField },
      admin: { readOnly: true, hidden: true },
    },
    {
      name: 'prevLocation',
      type: 'text',
      label: 'Прежнее место',
      access: { read: adminOrStaffField },
      admin: { readOnly: true, hidden: true },
    },
  ],
  timestamps: true,
}
