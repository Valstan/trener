import type { CollectionConfig } from 'payload'

import { adminOnly } from '../access/adminOnly'
import { adminOrSelf } from '../access/adminOrSelf'
import { hasRole, ownerField, rolesField } from '../access/roles'
import { cleanupUserRelations } from '../hooks/cleanupUserRelations'
import { ensureFirstUserAdmin } from '../hooks/ensureFirstUserAdmin'

export const Users: CollectionConfig = {
  slug: 'users',
  labels: {
    singular: 'Пользователь',
    plural: 'Пользователи',
  },
  access: {
    // Вход в админку: персонал (owner + admin + coach). Родители работают в
    // PWA-клиенте, не в админ-панели.
    admin: ({ req: { user } }) => hasRole(user, 'owner', 'admin', 'coach'),
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
  // Пара (authProvider, externalId) уникальна: одна внешняя личность — один аккаунт.
  // NULL-пары (обычные email-пользователи) под уникальность не попадают.
  indexes: [{ fields: ['authProvider', 'externalId'], unique: true }],
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
      // до owner хуком ensureFirstUserAdmin; персонал назначает роли вручную.
      defaultValue: ['parent'],
      saveToJWT: true,
      options: [
        { label: 'Владелец сети', value: 'owner' },
        { label: 'Администратор филиала', value: 'admin' },
        { label: 'Тренер', value: 'coach' },
        { label: 'Родитель', value: 'parent' },
        { label: 'Ребёнок', value: 'child' },
      ],
      access: {
        // Защита от самоповышения: owner — любые роли; админ филиала — только
        // coach/parent в своём филиале (rolesField, M5).
        update: rolesField,
      },
    },
    {
      name: 'login',
      type: 'text',
      label: 'Логин ребёнка',
      unique: true,
      index: true,
      access: { create: ownerField, update: ownerField },
      admin: { description: 'Только для детского входа; взрослые входят по email/VK.' },
    },
    // ── Связь с внешней личностью центра авторизации «Радар» (SSO через VK) ──
    // Заполняются ТОЛЬКО серверным путём VK-входа (findOrLinkRadarUser,
    // overrideAccess) либо админом вручную (отвязать аккаунт). Самослужебное
    // редактирование закрыто: иначе пользователь привязал бы чужой sub к себе.
    {
      name: 'authProvider',
      type: 'select',
      label: 'Внешний провайдер входа',
      options: [{ label: 'Радар-ID (VK)', value: 'radar' }],
      access: {
        create: ownerField,
        update: ownerField,
      },
      admin: {
        description: 'SSO-провайдер, через который связан аккаунт. Пусто — вход по email.',
      },
    },
    {
      name: 'externalId',
      type: 'text',
      label: 'Внешний ID (sub)',
      access: {
        create: ownerField,
        update: ownerField,
      },
      admin: {
        description: 'Стабильный идентификатор личности у провайдера (sub Радара).',
      },
    },
    // ── M5: филиал и модерация входа (docs/m5-design.md §2–3) ──
    {
      name: 'branch',
      type: 'relationship',
      label: 'Филиал',
      relationTo: 'branches',
      saveToJWT: true,
      access: {
        // Переводит между филиалами только владелец (админ филиала — в PR-B,
        // вместе с экраном заявок).
        create: ownerField,
        update: ownerField,
      },
      admin: {
        description:
          'Филиал участника — граница видимости. Пусто — только у владельцев сети.',
      },
    },
    {
      name: 'status',
      type: 'select',
      label: 'Статус участника',
      required: true,
      // PR-A: default approved — гейт модерации входа (pending + серверные
      // проверки контента) включается в PR-B вместе с экраном заявок, чтобы не
      // оставить пол-состояния. Существующие юзеры бэкфиллятся approved миграцией.
      defaultValue: 'approved',
      saveToJWT: true,
      options: [
        { label: 'Ждёт подтверждения', value: 'pending' },
        { label: 'Подтверждён', value: 'approved' },
      ],
      access: {
        create: ownerField,
        update: ownerField,
      },
    },
  ],
  hooks: {
    beforeChange: [ensureFirstUserAdmin],
    beforeDelete: [cleanupUserRelations],
  },
  timestamps: true,
}
