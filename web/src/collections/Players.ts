import type { Access, CollectionConfig, Where } from 'payload'

import { adminOrCoachOwnGroup } from '../access/byGroup'
import { cleanupPlayerRelations } from '../hooks/cleanupPlayerRelations'
import { coachGroupIds, hasRole, isAdmin, isCoach, isParent } from '../access/roles'

// Ребёнок (игрок).
//
// ⚠️ 152-ФЗ — МИНИМИЗАЦИЯ (kickoff §4, маркетинговый дифференциатор «никаких СНИЛС»):
//   храним ТОЛЬКО имя + группа + ссылку на контакт родителя (relationship → users).
//   НЕ собираем: даты рождения сверх нужного, фото (MVP), здоровье, адреса,
//   СНИЛС/паспорт. Каждое поле — с заявленной целью.
//
// ⚠️ #015 (write-authz day-1): доступ строго по роли — родитель видит ТОЛЬКО своих
//   детей, тренер — ТОЛЬКО детей своих групп. НЕ «любой authenticated».
const readPlayers: Access = async ({ req }) => {
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
    const where: Where = { parent: { equals: user.id } }
    return where
  }
  return false
}

export const Players: CollectionConfig = {
  slug: 'players',
  labels: {
    singular: 'Ребёнок',
    plural: 'Дети',
  },
  access: {
    create: ({ req: { user } }) => hasRole(user, 'admin', 'coach'),
    read: readPlayers,
    update: adminOrCoachOwnGroup,
    delete: adminOrCoachOwnGroup,
  },
  admin: {
    defaultColumns: ['name', 'group', 'parent'],
    useAsTitle: 'name',
    description:
      '152-ФЗ: минимизация. Только имя + группа + контакт родителя. Без дат рождения, фото, здоровья, адресов, СНИЛС.',
  },
  hooks: {
    beforeDelete: [cleanupPlayerRelations],
  },
  fields: [
    {
      name: 'name',
      type: 'text',
      label: 'Имя ребёнка',
      required: true,
      maxLength: 100,
    },
    {
      name: 'group',
      type: 'relationship',
      label: 'Группа',
      relationTo: 'groups',
      required: true,
    },
    {
      name: 'parent',
      type: 'relationship',
      label: 'Родитель (контакт)',
      relationTo: 'users',
      filterOptions: () => ({ roles: { in: ['parent'] } }),
      admin: {
        description:
          'Аккаунт родителя — контакт и адресат уведомлений. Привязывается при онбординге по magic-link (PR2).',
      },
    },
    {
      // Кнопка генерации ссылки-приглашения родителю (sidebar). Сама привязка —
      // через /join + magic-link (см. lib/auth/invite). Доступ к генерации
      // ограничен на стороне endpoint /auth/invite (staff + своя группа, #015).
      name: 'inviteLink',
      type: 'ui',
      admin: {
        position: 'sidebar',
        components: {
          Field: '@/components/admin/GenerateInviteLink',
        },
      },
    },
  ],
  timestamps: true,
}
