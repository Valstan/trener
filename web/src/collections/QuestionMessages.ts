import type { Access, CollectionConfig, Where } from 'payload'

import { adminOnly } from '../access/adminOnly'
import { coachGroupIds, isAdmin, isCoach, isParent } from '../access/roles'
import { fanOutQuestionReply } from '../hooks/fanOutQuestionReply'

// Сообщение в нитке «вопрос тренеру» — двусторонний чат M4 (kickoff §4/§8).
// Questions остаётся головой нитки (его body = первое сообщение, миграции данных
// нет); здесь — ответы тренера и последующие реплики родителя.
//
// Денормализация group/parent с головы нитки (проставляет reply-эндпоинт) — чтобы
// read-scope был плоским, как у Questions (G90-safe, без join-запросов по relationship).
//
// #015: create — server-only (/coach|/parent/question/[id]/reply проверяют владение,
// overrideAccess). author НЕ required намеренно: FK-грабля required-rel = NOT NULL ⨯
// ON DELETE SET NULL (см. cleanupUserRelations) — при удалении аккаунта тренера его
// реплики остаются в нитке родителя с author=null (рендер по authorRole).
const readMessages: Access = async ({ req }) => {
  const { user } = req
  if (!user) return false
  if (isAdmin(user)) return true
  if (isCoach(user)) {
    const ids = await coachGroupIds(req, user.id)
    if (!ids.length) return false
    const where: Where = { group: { in: ids } }
    return where
  }
  if (isParent(user)) {
    const where: Where = { parent: { equals: user.id } }
    return where
  }
  return false
}

export const QuestionMessages: CollectionConfig = {
  slug: 'question-messages',
  labels: {
    singular: 'Сообщение в переписке',
    plural: 'Переписка с тренером',
  },
  access: {
    create: () => false, // только reply-эндпоинты (overrideAccess после проверки владения)
    read: readMessages,
    update: adminOnly,
    delete: adminOnly,
  },
  admin: {
    defaultColumns: ['question', 'authorRole', 'createdAt'],
    useAsTitle: 'id',
    description: 'Нитки чата M4: голова — «Вопрос тренеру», здесь — ответы и реплики.',
  },
  hooks: {
    afterChange: [fanOutQuestionReply],
  },
  fields: [
    {
      name: 'question',
      type: 'relationship',
      label: 'Нитка (вопрос)',
      relationTo: 'questions',
      required: true,
      index: true,
    },
    {
      name: 'group',
      type: 'relationship',
      label: 'Группа (денорм.)',
      relationTo: 'groups',
      required: true,
      index: true,
    },
    {
      name: 'parent',
      type: 'relationship',
      label: 'Родитель нитки (денорм.)',
      relationTo: 'users',
      required: true,
      index: true,
      filterOptions: () => ({ roles: { in: ['parent'] } }),
    },
    {
      name: 'author',
      type: 'relationship',
      label: 'Автор',
      relationTo: 'users',
      // не required: SET NULL при удалении аккаунта автора (см. шапку файла)
    },
    {
      name: 'authorRole',
      type: 'select',
      label: 'Кто написал',
      required: true,
      options: [
        { label: 'Родитель', value: 'parent' },
        { label: 'Тренер', value: 'coach' },
      ],
    },
    {
      name: 'body',
      type: 'textarea',
      label: 'Сообщение',
      required: true,
      maxLength: 1000,
    },
  ],
  timestamps: true,
}
