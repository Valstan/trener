import type { Access, CollectionConfig, Where } from 'payload'

import { isOwner, isParent } from '../access/roles'
import { cleanupPaymentThread } from '../hooks/cleanupPaymentThread'

export const readPaymentThreads: Access = ({ req: { user } }) => {
  if (!user) return false
  if (isOwner(user)) return true
  if (isParent(user)) return { parent: { equals: user.id } }
  return false
}

export const readPaymentMessages: Access = async ({ req }) => {
  const { user } = req
  if (!user) return false
  if (isOwner(user)) return true
  if (!isParent(user)) return false
  const threads = await req.payload.find({
    collection: 'payment-threads',
    where: { parent: { equals: user.id } },
    depth: 0,
    limit: 100,
    pagination: false,
    overrideAccess: true,
  })
  const ids = threads.docs.map((thread) => thread.id)
  if (!ids.length) return false
  const where: Where = { thread: { in: ids } }
  return where
}

export const PaymentThreads: CollectionConfig = {
  slug: 'payment-threads',
  labels: { singular: 'Платёжный диалог', plural: 'Платёжные диалоги' },
  access: { create: () => false, read: readPaymentThreads, update: () => false, delete: () => false },
  admin: {
    defaultColumns: ['parent', 'branch', 'lastMessageAt'],
    description: 'Неудаляемые личные диалоги родителей с бухгалтерией. Ведутся из приложения.',
  },
  hooks: { beforeDelete: [cleanupPaymentThread] },
  indexes: [{ fields: ['parent', 'branch'], unique: true }],
  fields: [
    { name: 'parent', type: 'relationship', relationTo: 'users', required: true, index: true },
    { name: 'branch', type: 'relationship', relationTo: 'branches', index: true },
    { name: 'lastMessageAt', type: 'date', required: true, index: true, admin: { readOnly: true } },
  ],
  timestamps: true,
}

export const PaymentMessages: CollectionConfig = {
  slug: 'payment-messages',
  labels: { singular: 'Сообщение об оплате', plural: 'Сообщения об оплате' },
  access: { create: () => false, read: readPaymentMessages, update: () => false, delete: () => false },
  admin: { defaultColumns: ['thread', 'authorName', 'createdAt'], description: 'История неизменяема и не удаляется.' },
  fields: [
    { name: 'thread', type: 'relationship', relationTo: 'payment-threads', required: true, index: true },
    { name: 'author', type: 'relationship', relationTo: 'users' },
    { name: 'authorName', type: 'text', required: true, maxLength: 120 },
    { name: 'authorRole', type: 'select', required: true, options: [{ label: 'Родитель', value: 'parent' }, { label: 'Бухгалтерия', value: 'staff' }] },
    { name: 'body', type: 'textarea', required: true, maxLength: 2000 },
  ],
  timestamps: true,
}
