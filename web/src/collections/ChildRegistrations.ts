import type { Access, CollectionConfig } from 'payload'

import { isFullOwner, isParent } from '../access/roles'
import { fanOutRegistration } from '../hooks/fanOutRegistration'

const read: Access = ({ req }) => {
  if (isFullOwner(req.user)) return true
  if (isParent(req.user)) return { proposedParent: { equals: req.user!.id } }
  return false
}

export const ChildRegistrations: CollectionConfig = {
  slug: 'child-registrations',
  labels: { singular: 'Заявка ребёнка', plural: 'Заявки детей' },
  access: { create: () => false, read, update: () => false, delete: ({ req }) => isFullOwner(req.user) },
  admin: { useAsTitle: 'childName', defaultColumns: ['childName', 'parentName', 'status', 'createdAt'] },
  // Пуш на каждом стыке цепочки ребёнок→родитель→группа (см. fanOutRegistration).
  hooks: { afterChange: [fanOutRegistration] },
  fields: [
    { name: 'account', type: 'relationship', relationTo: 'users', required: true, unique: true, index: true },
    { name: 'childName', type: 'text', required: true, maxLength: 120 },
    { name: 'dateOfBirth', type: 'date', required: true },
    { name: 'parentName', type: 'text', required: true, maxLength: 120 },
    { name: 'proposedParent', type: 'relationship', relationTo: 'users', index: true, filterOptions: () => ({ roles: { in: ['parent'] } }) },
    { name: 'branch', type: 'relationship', relationTo: 'branches', index: true },
    { name: 'status', type: 'select', required: true, defaultValue: 'owner_review', index: true, options: [
      { label: 'Проверяет владелец', value: 'owner_review' },
      { label: 'Ожидается родитель', value: 'parent_review' },
      { label: 'Подтверждена', value: 'accepted' },
      { label: 'Отклонена', value: 'rejected' },
    ] },
  ],
  timestamps: true,
}
