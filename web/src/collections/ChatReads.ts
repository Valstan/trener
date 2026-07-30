import type { CollectionConfig } from 'payload'

import { adminOnly } from '../access/adminOnly'
import { selfByUser } from '../access/scoped'

// Отметка «до какого момента я прочитал тему» (M9). Одна запись на пару
// (участник × тема) — по ней в списке тем горит точка «есть новое».
//
// Почему отдельная коллекция, а не поле в теме: тема одна на всю группу, а
// прочитанность у каждого своя. И почему момент, а не счётчик: счётчик надо
// пересчитывать при каждом новом сообщении всем участникам сразу, а момент
// сравнивается с уже готовым topic.lastMessageAt — ноль дополнительных записей
// при отправке сообщения.
//
// Видит и правит запись только её владелец (selfByUser): чужая прочитанность —
// не наше дело и не дело тренера.
export const ChatReads: CollectionConfig = {
  slug: 'chat-reads',
  labels: {
    singular: 'Отметка прочтения',
    plural: 'Отметки прочтения чатов',
  },
  access: {
    create: () => false, // только /chat/read (overrideAccess после проверки участия)
    read: selfByUser,
    update: () => false,
    delete: adminOnly,
  },
  admin: {
    defaultColumns: ['user', 'topic', 'lastReadAt'],
    useAsTitle: 'id',
    description: 'Служебное: кто до какого момента прочитал тему. Заполняется само при открытии темы.',
    hidden: true,
  },
  fields: [
    {
      name: 'user',
      type: 'relationship',
      label: 'Участник',
      relationTo: 'users',
      required: true,
      index: true,
      // ⚠️ G149-класс: удаление аккаунта чистит отметки в cleanupUserRelations.
    },
    {
      name: 'topic',
      type: 'relationship',
      label: 'Тема',
      relationTo: 'chat-topics',
      required: true,
      index: true,
      // Удаление темы чистит отметки в cleanupTopicRelations.
    },
    {
      name: 'lastReadAt',
      type: 'date',
      label: 'Прочитано до',
      required: true,
    },
  ],
  timestamps: true,
}
