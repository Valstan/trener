import type { Access, CollectionConfig, Where } from 'payload'

import { adminBranchId, isFullOwner, isParent } from '../access/roles'
import { cleanupPaymentThread } from '../hooks/cleanupPaymentThread'
import { fanOutPaymentMessage } from '../hooks/fanOutPaymentMessage'

// Доводка 09.08: админ филиала — ведёт учёт оплат филиала, но был отрезан от
// платёжных диалогов (только owner). Роль «бухгалтер филиала» существовала
// наполовину: записывать абонементы можно, а ответить родителю на вопрос об
// оплате — нет. Теперь он видит нити СВОЕГО филиала.
export const readPaymentThreads: Access = ({ req: { user } }) => {
  if (!user) return false
  if (isFullOwner(user)) return true
  const branch = adminBranchId(user)
  if (branch != null) {
    const where: Where = { branch: { equals: branch } }
    return where
  }
  if (isParent(user)) {
    const where: Where = { parent: { equals: user.id } }
    return where
  }
  return false
}

export const readPaymentMessages: Access = async ({ req }) => {
  const { user } = req
  if (!user) return false
  if (isFullOwner(user)) return true
  const branch = adminBranchId(user)
  const scope: Where | null = branch != null
    ? { branch: { equals: branch } }
    : isParent(user)
      ? { parent: { equals: user.id } }
      : null
  if (!scope) return false
  const threads = await req.payload.find({
    collection: 'payment-threads',
    where: scope,
    depth: 0,
    limit: 1000,
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
  // Пуш второй стороне диалога (родителю или бухгалтерии) — раньше нить молчала.
  hooks: { afterChange: [fanOutPaymentMessage] },
  fields: [
    { name: 'thread', type: 'relationship', relationTo: 'payment-threads', required: true, index: true },
    { name: 'author', type: 'relationship', relationTo: 'users' },
    { name: 'authorName', type: 'text', required: true, maxLength: 120 },
    { name: 'authorRole', type: 'select', required: true, options: [{ label: 'Родитель', value: 'parent' }, { label: 'Бухгалтерия', value: 'staff' }] },
    { name: 'body', type: 'textarea', required: true, maxLength: 2000 },
  ],
  timestamps: true,
}
