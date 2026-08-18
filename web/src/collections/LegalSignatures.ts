import type { Access, CollectionConfig } from 'payload'

import { isFullOwner, isParent } from '../access/roles'

// Журнал юридических фактов (D-016): подписания договора поручения (филиал) и
// согласия родителя, а также ОТЗЫВЫ согласий. Требование мандата: подпись — не
// булев флаг, а неизменяемая запись «кто, когда (UTC), под чем (content_hash),
// с какого IP/устройства, при каких реквизитах оператора».
//
// Иммутабельность: create — только server-mediated маршруты (overrideAccess),
// update/delete — НИКОМУ, включая владельца. Отзыв — новая запись action=withdrawn,
// не правка старой. Проверка мандата: «через год родитель отзывает согласие — можно
// показать точный текст, который он видел» → hash + неизменяемые версии документов.
const read: Access = ({ req }) => {
  if (isFullOwner(req.user)) return true
  if (isParent(req.user)) return { signer: { equals: req.user!.id } }
  return false
}

export const LegalSignatures: CollectionConfig = {
  slug: 'legal-signatures',
  labels: { singular: 'Юридическая подпись', plural: 'Журнал подписей' },
  access: {
    read,
    create: () => false,
    update: () => false,
    delete: () => false,
  },
  admin: {
    defaultColumns: ['kind', 'action', 'branch', 'signer', 'signedAt'],
    description: 'Неизменяемый журнал: подписания и отзывы. Записи создаёт только сервер.',
  },
  fields: [
    {
      name: 'kind',
      type: 'select',
      required: true,
      index: true,
      options: [
        { label: 'Договор поручения', value: 'processing_agreement' },
        { label: 'Согласие родителя', value: 'parent_consent' },
      ],
    },
    {
      name: 'action',
      type: 'select',
      required: true,
      defaultValue: 'signed',
      index: true,
      options: [
        { label: 'Подписано', value: 'signed' },
        { label: 'Отозвано', value: 'withdrawn' },
      ],
    },
    { name: 'document', type: 'relationship', relationTo: 'legal-documents', required: true, index: true },
    {
      name: 'contentHash',
      type: 'text',
      required: true,
      admin: { description: 'Снапшот отпечатка версии на момент подписи.' },
    },
    { name: 'branch', type: 'relationship', relationTo: 'branches', index: true },
    { name: 'signer', type: 'relationship', relationTo: 'users', index: true },
    { name: 'players', type: 'relationship', relationTo: 'players', hasMany: true },
    { name: 'signedAt', type: 'date', required: true, index: true },
    { name: 'ip', type: 'text', maxLength: 64 },
    { name: 'userAgent', type: 'text', maxLength: 512 },
    {
      name: 'requisitesSnapshot',
      type: 'json',
      admin: { description: 'Реквизиты оператора-филиала на момент подписи.' },
    },
  ],
  timestamps: true,
}
