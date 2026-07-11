import type { Access, CollectionConfig, Where } from 'payload'

import { adminOrCoachOwnGroup } from '../access/byGroup'
import { coachGroupIds, isAdmin, isCoach, isParent, parentGroupIds } from '../access/roles'

// Результат матча (дорожная карта §4, после M3). Информационный канал поверх ядра
// M2 — как Announcements: НЕ ack-очередь, НЕ создаёт Notifications, НЕ влияет на
// coverage «N из M» (F1: ров = только изменения расписания, kickoff §1). Родитель
// видит результаты групп СВОИХ детей; тренер заводит результаты своих групп.
//
// ⚠️ 152-ФЗ — МИНИМИЗАЦИЯ (kickoff §5, day-1 floor). Авторы голов (`scorers`) —
// relationship → players, хранит ТОЛЬКО имя ребёнка. Показывается всем родителям
// группы (расширение против Players.read, где родитель видит лишь своих детей) →
// цель обработки — публикация спортивного результата команды; должна быть покрыта
// целями согласия перед прод-выкаткой. Никаких иных детских данных в матче нет.
//
// #015 (authz по ролям): write — только тренер своей группы (adminOrCoachOwnGroup,
// по полю group); read — scoped плоский `{group:{in: ids}}` (G90-safe: служебные
// find в хелперах идут overrideAccess).
const readMatches: Access = async ({ req }) => {
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

export const Matches: CollectionConfig = {
  slug: 'matches',
  labels: {
    singular: 'Матч',
    plural: 'Результаты матчей',
  },
  access: {
    create: adminOrCoachOwnGroup,
    read: readMatches,
    update: adminOrCoachOwnGroup,
    delete: adminOrCoachOwnGroup,
  },
  admin: {
    defaultColumns: ['matchDate', 'group', 'opponent', 'homeAway'],
    useAsTitle: 'opponent',
    description: 'Результаты игр. Информационный канал (coverage не затрагивает). Голы детей — 152-ФЗ: только имя.',
  },
  fields: [
    {
      name: 'group',
      type: 'relationship',
      label: 'Группа',
      relationTo: 'groups',
      required: true,
      index: true,
    },
    {
      name: 'matchDate',
      type: 'date',
      label: 'Дата матча',
      required: true,
      index: true,
      admin: {
        date: { pickerAppearance: 'dayAndTime' },
      },
    },
    {
      name: 'opponent',
      type: 'text',
      label: 'Соперник',
      required: true,
      maxLength: 120,
    },
    {
      name: 'homeAway',
      type: 'select',
      label: 'Где',
      required: true,
      defaultValue: 'home',
      options: [
        { label: 'Дома', value: 'home' },
        { label: 'В гостях', value: 'away' },
      ],
      admin: { position: 'sidebar' },
    },
    {
      name: 'location',
      type: 'text',
      label: 'Место проведения',
      maxLength: 200,
    },
    {
      name: 'scoreOur',
      type: 'number',
      label: 'Голов наши',
      required: true,
      min: 0,
      defaultValue: 0,
    },
    {
      name: 'scoreOpponent',
      type: 'number',
      label: 'Голов соперник',
      required: true,
      min: 0,
      defaultValue: 0,
    },
    {
      name: 'scorers',
      type: 'array',
      label: 'Авторы голов',
      labels: { singular: 'Гол', plural: 'Голы' },
      admin: {
        description: '152-ФЗ: только имя ребёнка (из справочника Дети). Виден родителям группы.',
      },
      fields: [
        {
          name: 'player',
          type: 'relationship',
          label: 'Игрок',
          relationTo: 'players',
          required: true,
          // Выбор ограничен детьми ЭТОЙ группы (по полю group матча).
          filterOptions: ({ data }) =>
            data?.group ? { group: { equals: data.group } } : true,
        },
        {
          name: 'goals',
          type: 'number',
          label: 'Голов',
          required: true,
          defaultValue: 1,
          min: 1,
        },
      ],
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
