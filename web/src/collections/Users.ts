import type { CollectionConfig } from 'payload'

import { adminOnly } from '../access/adminOnly'
import { adminOrSelf } from '../access/adminOrSelf'
import { adminField, hasRole } from '../access/roles'
import { ensureFirstUserAdmin } from '../hooks/ensureFirstUserAdmin'

export const Users: CollectionConfig = {
  slug: 'users',
  labels: {
    singular: 'Пользователь',
    plural: 'Пользователи',
  },
  access: {
    // Вход в админку: персонал (admin + coach). Родители работают в PWA-клиенте,
    // не в админ-панели.
    admin: ({ req: { user } }) => hasRole(user, 'admin', 'coach'),
    create: adminOnly,
    delete: adminOnly,
    read: adminOrSelf,
    update: adminOrSelf,
  },
  admin: {
    defaultColumns: ['name', 'email', 'roles'],
    useAsTitle: 'name',
  },
  auth: true,
  fields: [
    {
      name: 'name',
      type: 'text',
      label: 'Имя',
    },
    {
      name: 'phone',
      type: 'text',
      label: 'Телефон',
      maxLength: 32,
      admin: {
        description: 'Контакт тренера/родителя. 152-ФЗ: минимизация — только для связи.',
      },
    },
    {
      name: 'roles',
      type: 'select',
      label: 'Роли',
      hasMany: true,
      required: true,
      // Наименее привилегированная роль по умолчанию. Первый пользователь повышается
      // до admin хуком ensureFirstUserAdmin; персонал назначает роли вручную.
      defaultValue: ['parent'],
      saveToJWT: true,
      options: [
        { label: 'Администратор', value: 'admin' },
        { label: 'Тренер', value: 'coach' },
        { label: 'Родитель', value: 'parent' },
      ],
      access: {
        // Менять роли может только админ (защита от самоповышения привилегий).
        update: adminField,
      },
    },
  ],
  hooks: {
    beforeChange: [ensureFirstUserAdmin],
  },
  timestamps: true,
}
