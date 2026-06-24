import type { Access, CollectionConfig } from 'payload'

import { adminOnly } from '../access/adminOnly'
import { adminOrStaffField, isAdmin } from '../access/roles'
import { CONSENT_POLICY_VERSION } from '../lib/consent'

// Согласие родителя/законного представителя на обработку ПДн ребёнка (152-ФЗ).
// ← Sabantuy Registrations.ts, ужесточено для детских данных.
//
// 152-ФЗ §5.3: согласие — отдельный осознанный акт (не чекбокс в оферте). Фиксируем:
// личность согласующего (parent), охваченных детей (players), версию текста
// (policyVersion, паттерн G7 `_v`), подтверждение представительства (staff), момент
// (timestamps). Полноценный UX «отдельной бумагой» — PR3; здесь — модель и хранение.
//
// #015: read закрыт (admin + сам родитель); правка/удаление — только админ
// (согласие — юридическая запись, не редактируется задним числом обычными ролями).
const readConsents: Access = ({ req: { user } }) => {
  if (!user) return false
  if (isAdmin(user)) return true
  // Родитель видит только свои согласия.
  return { parent: { equals: user.id } }
}

export const Consents: CollectionConfig = {
  slug: 'consents',
  labels: {
    singular: 'Согласие (152-ФЗ)',
    plural: 'Согласия (152-ФЗ)',
  },
  access: {
    // Согласие создаёт сам родитель при онбординге (PR2) либо персонал.
    create: ({ req: { user } }) => Boolean(user),
    read: readConsents,
    update: adminOnly,
    delete: adminOnly,
  },
  admin: {
    defaultColumns: ['parent', 'players', 'policyVersion', 'createdAt'],
    useAsTitle: 'parent',
    description:
      'Юридическая запись согласия на обработку ПДн ребёнка (152-ФЗ). Доступ — только персонал и сам родитель.',
  },
  fields: [
    {
      name: 'parent',
      type: 'relationship',
      label: 'Родитель / законный представитель',
      relationTo: 'users',
      required: true,
      filterOptions: () => ({ roles: { in: ['parent'] } }),
    },
    {
      name: 'players',
      type: 'relationship',
      label: 'Дети, на которых даётся согласие',
      relationTo: 'players',
      hasMany: true,
    },
    {
      name: 'consentGiven',
      type: 'checkbox',
      label: 'Согласие на обработку персональных данных дано',
      required: true,
      validate: (value: unknown) =>
        value === true || 'Без согласия на обработку персональных данных продолжить нельзя.',
      admin: {
        description: 'Обязательно. Осознанное согласие законного представителя ребёнка.',
      },
    },
    {
      name: 'confirmedRepresentative',
      type: 'checkbox',
      label: 'Подтверждено: согласующий — законный представитель ребёнка',
      defaultValue: false,
      // Служебное поле: подтверждает персонал. Родитель при self-create его не задаёт
      // (значение отбрасывается, применяется defaultValue false).
      access: {
        create: adminOrStaffField,
        update: adminOrStaffField,
      },
      admin: {
        position: 'sidebar',
      },
    },
    {
      name: 'policyVersion',
      type: 'text',
      label: 'Версия политики/согласия',
      required: true,
      defaultValue: CONSENT_POLICY_VERSION,
      admin: {
        position: 'sidebar',
        description: 'Версия текста согласия/политики на момент подписания (G7 `_v`).',
      },
    },
  ],
  timestamps: true,
}
