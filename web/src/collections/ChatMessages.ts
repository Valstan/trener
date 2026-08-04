import type { CollectionConfig } from 'payload'

import { readChatScope } from '../access/chatScope'
import { isOwner } from '../access/roles'
import { fanOutChatMessage } from '../hooks/fanOutChatMessage'

// Сообщение в теме общей комнаты (M9). Пишет любой участник группы — но только
// через маршрут /chat/message: он проверяет, что тема автору видна и не закрыта.
// Поэтому create в access закрыт наглухо, как у question-messages.
//
// Денормализация:
//   • group — копия group темы. Read-scope тогда плоский (`group in [...]`), без
//     join'а по relationship: ровно тот же приём, что в question-messages.
//   • authorName/authorRole — снимок на момент отправки. Без него удаление аккаунта
//     тренера (author занулится по cleanupUserRelations) превратило бы полгода
//     переписки в анонимные реплики.
export const ChatMessages: CollectionConfig = {
  slug: 'chat-messages',
  labels: {
    singular: 'Сообщение в чате',
    plural: 'Сообщения в чатах',
  },
  access: {
    create: () => false, // только /chat/message (overrideAccess после проверки участия)
    read: readChatScope,
    update: () => false,
    delete: ({ req }) => isOwner(req.user),
  },
  hooks: {
    afterChange: [fanOutChatMessage],
  },
  admin: {
    defaultColumns: ['topic', 'authorName', 'createdAt'],
    useAsTitle: 'id',
    description: 'Сообщения в темах общих чатов. Заводить и править вручную не нужно — пишутся из приложения.',
  },
  fields: [
    {
      name: 'scope', type: 'select', defaultValue: 'group', index: true,
      options: [{ label: 'Группа', value: 'group' }, { label: 'Филиал', value: 'branch' }, { label: 'Вся школа', value: 'school' }], admin: { readOnly: true },
    },
    {
      name: 'room',
      type: 'select',
      label: 'Комната',
      required: true,
      defaultValue: 'adults',
      index: true,
      options: [
        { label: 'Взрослая', value: 'adults' },
        { label: 'Детская', value: 'children' },
      ],
      admin: { readOnly: true },
    },
    { name: 'branch', type: 'relationship', relationTo: 'branches', index: true, admin: { readOnly: true } },
    {
      name: 'topic',
      type: 'relationship',
      label: 'Тема',
      relationTo: 'chat-topics',
      required: true,
      index: true,
      // ⚠️ G149-класс (см. ChatTopics.group): удаление темы чистит сообщения
      // заранее — cleanupTopicRelations, beforeDelete.
    },
    {
      name: 'group',
      type: 'relationship',
      label: 'Группа',
      relationTo: 'groups',
      required: false,
      index: true,
      admin: { readOnly: true, description: 'Копируется с темы — по ней считается видимость.' },
    },
    {
      name: 'author',
      type: 'relationship',
      label: 'Автор',
      relationTo: 'users',
      // НЕ required: аккаунт могут удалить, сообщение остаётся (см. authorName).
    },
    {
      name: 'authorName',
      type: 'text',
      label: 'Имя автора',
      maxLength: 120,
      admin: { readOnly: true, description: 'Снимок имени на момент отправки — переписка переживает удаление аккаунта.' },
    },
    {
      name: 'authorRole',
      type: 'select',
      label: 'Кто написал',
      options: [
        { label: 'Тренер', value: 'coach' },
        { label: 'Администрация школы', value: 'staff' },
        { label: 'Родитель', value: 'parent' },
        { label: 'Ребёнок', value: 'child' },
      ],
      admin: { readOnly: true },
    },
    {
      name: 'body',
      type: 'textarea',
      label: 'Сообщение',
      required: true,
      maxLength: 2000,
    },
  ],
  timestamps: true,
}
