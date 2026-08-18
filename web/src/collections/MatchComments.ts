import type { CollectionConfig } from 'payload'

import { isFullOwner } from '../access/roles'
import { demoGuestLimit } from '../hooks/demoGuestLimit'
import { fanOutMatchComment } from '../hooks/fanOutMatchComment'
import { readMatchParticipants } from './Matches'

export const MatchComments: CollectionConfig = {
  slug: 'match-comments',
  labels: { singular: 'Комментарий к матчу', plural: 'Комментарии к матчам' },
  access: {
    create: () => false,
    read: readMatchParticipants,
    update: () => false,
    delete: ({ req }) => isFullOwner(req.user),
  },
  admin: {
    useAsTitle: 'authorName',
    defaultColumns: ['match', 'authorName', 'createdAt'],
    description: 'Комментарии участников группы. Редактирование запрещено; владелец может удалить сообщение при модерации.',
  },
  // Пуш участникам группы (раньше комментарии создавались молча).
  hooks: { afterChange: [fanOutMatchComment], beforeChange: [demoGuestLimit] },
  fields: [
    // D-029: лимит 5 сущностей на демо-посетителя. Ставится ТОЛЬКО хуком
    // demoGuestLimit (field-access режет только клиентский ввод).
    {
      name: 'demoGuest',
      type: 'checkbox',
      defaultValue: false,
      admin: { hidden: true },
      access: { create: () => false, update: () => false },
    },
    { name: 'match', type: 'relationship', relationTo: 'matches', required: true, index: true },
    { name: 'group', type: 'relationship', relationTo: 'groups', required: true, index: true, admin: { readOnly: true } },
    { name: 'author', type: 'relationship', relationTo: 'users', admin: { readOnly: true } },
    { name: 'authorName', type: 'text', required: true, maxLength: 120, admin: { readOnly: true } },
    {
      name: 'authorRole',
      type: 'select',
      required: true,
      options: [
        { label: 'Ребёнок', value: 'child' },
        { label: 'Родитель', value: 'parent' },
        { label: 'Тренер', value: 'coach' },
        { label: 'Администрация', value: 'staff' },
      ],
      admin: { readOnly: true },
    },
    { name: 'body', type: 'textarea', required: true, maxLength: 2000 },
  ],
  timestamps: true,
}
