import type { Access, CollectionConfig, Where } from 'payload'

import { adminOnly } from '../access/adminOnly'
import { coachGroupIds, isAdmin, isCoach, isParent } from '../access/roles'
import { cleanupQuestionRelations } from '../hooks/cleanupQuestionRelations'
import { fanOutQuestion } from '../hooks/fanOutQuestion'

// Вопрос родителя тренеру (M3-PR11) — суррогат чата (kickoff §4/§8). ОДНО сообщение,
// привязанное к группе (опц. к сессии). БЕЗ домена Threads/Messages — полный
// двусторонний чат = M4 (тогда Questions мигрирует в первое сообщение нитки).
//
// Направление обратное M2: адресат — ТРЕНЕР. Поэтому отдельная лёгкая коллекция, а не
// поле в Notifications (та parent-addressed под волны расписания). Своя status-машина
// (new→read→answered) — как ack-инфра, но односторонняя: тренер прочитал/ответил
// (оффлайн/звонком, контакт родителя у него есть). НЕ влияет на coverage (F1).
//
// #015: create — server-only (эндпоинт /parent/question проверяет владение группой
// через ребёнка, overrideAccess). read — scoped: родитель свои (parent==user), тренер
// по своим группам (плоский {group:{in: coachGroupIds}}, G90-safe). update — adminOnly,
// статус двигает эндпоинт тренера (overrideAccess после проверки владения).
const readQuestions: Access = async ({ req }) => {
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

export const Questions: CollectionConfig = {
  slug: 'questions',
  labels: {
    singular: 'Вопрос тренеру',
    plural: 'Вопросы тренеру',
  },
  access: {
    create: () => false, // только эндпоинт /parent/question (overrideAccess после проверки владения)
    read: readQuestions,
    update: adminOnly, // статус — через эндпоинт тренера (overrideAccess); прямой client-write закрыт
    delete: adminOnly,
  },
  admin: {
    defaultColumns: ['group', 'parent', 'status', 'createdAt'],
    useAsTitle: 'id',
    description: 'Суррогат чата (M4 — полный чат). Односторонне: родитель спросил → тренер прочитал/ответил. Вне coverage.',
  },
  hooks: {
    afterChange: [fanOutQuestion],
    // M4: реплики нитки — required FK на вопрос; чистим до удаления головы.
    beforeDelete: [cleanupQuestionRelations],
  },
  fields: [
    {
      name: 'parent',
      type: 'relationship',
      label: 'Родитель (автор)',
      relationTo: 'users',
      required: true,
      index: true,
      filterOptions: () => ({ roles: { in: ['parent'] } }),
    },
    {
      name: 'group',
      type: 'relationship',
      label: 'Группа',
      relationTo: 'groups',
      required: true,
      index: true,
    },
    {
      name: 'session',
      type: 'relationship',
      label: 'Тренировка (контекст, опц.)',
      relationTo: 'training-sessions',
    },
    {
      name: 'body',
      type: 'textarea',
      label: 'Вопрос',
      required: true,
      maxLength: 1000,
    },
    {
      name: 'status',
      type: 'select',
      label: 'Статус',
      required: true,
      defaultValue: 'new',
      index: true,
      options: [
        { label: 'Новый', value: 'new' },
        { label: 'Прочитан', value: 'read' },
        { label: 'Отвечен', value: 'answered' },
      ],
      admin: { description: 'new→read→answered. Двигает тренер через инбокс.' },
    },
    {
      name: 'readAt',
      type: 'date',
      label: 'Прочитан в',
      admin: { readOnly: true, position: 'sidebar' },
    },
    {
      name: 'answeredAt',
      type: 'date',
      label: 'Отвечен в',
      admin: { readOnly: true, position: 'sidebar' },
    },
  ],
  timestamps: true,
}
