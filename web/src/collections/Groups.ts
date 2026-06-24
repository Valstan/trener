import type { Access, CollectionConfig } from 'payload'

import { adminOnly } from '../access/adminOnly'
import { coachGroupIds, isAdmin, isCoach, isParent, parentGroupIds } from '../access/roles'

// Группа (команда) детской футбольной школы: имя + тренер(ы) + состав (Players).
const readGroups: Access = async ({ req }) => {
  const { user } = req
  if (!user) return false
  if (isAdmin(user)) return true
  if (isCoach(user)) {
    const ids = await coachGroupIds(req, user.id)
    if (!ids.length) return false
    return { id: { in: ids } }
  }
  if (isParent(user)) {
    const ids = await parentGroupIds(req, user.id)
    if (!ids.length) return false
    return { id: { in: ids } }
  }
  return false
}

// Тренер правит только свои группы; админ — все.
const updateGroups: Access = async ({ req }) => {
  const { user } = req
  if (!user) return false
  if (isAdmin(user)) return true
  if (isCoach(user)) return { coaches: { in: [user.id] } }
  return false
}

export const Groups: CollectionConfig = {
  slug: 'groups',
  labels: {
    singular: 'Группа',
    plural: 'Группы',
  },
  access: {
    create: adminOnly,
    delete: adminOnly,
    read: readGroups,
    update: updateGroups,
  },
  admin: {
    defaultColumns: ['name', 'coaches'],
    useAsTitle: 'name',
  },
  fields: [
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
  ],
  timestamps: true,
}
