import type { CollectionConfig } from 'payload'

import { readChatScope } from '../access/chatScope'
import { isOwner } from '../access/roles'
import { cleanupTopicRelations } from '../hooks/cleanupTopicRelations'

// Тема во «взрослой комнате» группы (M9, видение v2 §3.3). Комната — это сама
// группа: её тренеры + родители её детей. Отдельной сущности «комната» нет
// намеренно — граница видимости у нас и так проходит по группе, а вторая
// сущность поверх неё только добавила бы способов разойтись с правами.
//
// Детская комната (дети между собой) — веха M11, после юр-проработки роли
// «ребёнок»: у нас нет ни аккаунтов детей, ни согласия на их переписку.
//
// Кто заводит темы: тренер своей группы, админ филиала, владелец. Родитель пишет
// в существующие темы, но не плодит новые — иначе список расползается в первый же
// месяц, а модерировать его некому.
export const ChatTopics: CollectionConfig = {
  slug: 'chat-topics',
  labels: {
    singular: 'Тема в чате',
    plural: 'Темы в чате',
  },
  access: {
    create: () => false,
    read: readChatScope,
    update: ({ req }) => isOwner(req.user),
    delete: ({ req }) => isOwner(req.user),
  },
  admin: {
    defaultColumns: ['title', 'group', 'lastMessageAt', 'closed'],
    useAsTitle: 'title',
    description:
      'Темы общих чатов групп: тренеры и родители одной группы. Тему заводит тренер, писать в неё могут все участники группы.',
  },
  hooks: {
    // Гейт «своя группа» — в beforeValidate, а не только в access: на создании
    // access-Where ничего не ограничивает (см. комментарий в guardTopicGroup).
    beforeDelete: [cleanupTopicRelations],
  },
  fields: [
    {
      name: 'scope', type: 'select', label: 'Область', defaultValue: 'group', index: true,
      options: [{ label: 'Группа', value: 'group' }, { label: 'Филиал', value: 'branch' }, { label: 'Вся школа', value: 'school' }],
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
    },
    { name: 'branch', type: 'relationship', label: 'Филиал', relationTo: 'branches', index: true },
    {
      name: 'title',
      type: 'text',
      label: 'Тема',
      required: true,
      maxLength: 120,
      admin: { description: 'О чём разговор — например, «Едем на соревнования 12 сентября».' },
    },
    {
      name: 'group',
      type: 'relationship',
      label: 'Группа',
      relationTo: 'groups',
      required: false,
      index: true,
      // ⚠️ G149-класс: required relationship = NOT NULL FK × ON DELETE SET NULL.
      // Тот же расклад, что у players.group: группу с живой перепиской не удалить,
      // пока темы не убраны. Это осознанно — молчаливый каскад по переписке хуже.
    },
    {
      name: 'createdBy',
      type: 'relationship',
      label: 'Кто завёл',
      relationTo: 'users',
      // НЕ required намеренно: удаление аккаунта тренера не должно уносить тему
      // всей группы (cleanupUserRelations занулит ссылку, тема останется).
    },
    {
      name: 'lastMessageAt',
      type: 'date',
      label: 'Последнее сообщение',
      index: true,
      admin: {
        readOnly: true,
        description: 'Проставляется сама при новом сообщении — по ней темы идут сверху вниз.',
      },
    },
    {
      name: 'closed',
      type: 'checkbox',
      label: 'Тема закрыта',
      defaultValue: false,
      admin: {
        description: 'Закрытую тему видно, но написать в неё нельзя. Удобно для разъехавшихся разговоров.',
      },
    },
  ],
  timestamps: true,
}
