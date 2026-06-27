import config from '@payload-config'
import { headers as nextHeaders } from 'next/headers'
import { redirect } from 'next/navigation'
import { getPayload } from 'payload'
import React from 'react'

import type { Group, User } from '@/payload-types'
import { isAdmin, isCoach } from '@/access/roles'
import { relId } from '@/lib/relId'

import { AppShell, COACH_TABS } from '../../components/AppShell'
import { CoachQuestions, type QuestionItem } from './CoachQuestions'

// Инбокс вопросов тренеру (M3-PR11). Доступ: персонал; читается scoped (тренер — вопросы
// своих групп, #015). Имя/контакт родителя тренеру виден (он ведёт ребёнка) — для ответа
// оффлайн. Вне coverage (F1). Двусторонняя переписка — M4.
export const dynamic = 'force-dynamic'

const CoachQuestionsPage = async () => {
  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers: await nextHeaders() })
  if (!user) redirect('/login')
  if (!(isCoach(user) || isAdmin(user))) redirect('/')

  const questions = await payload.find({
    collection: 'questions',
    sort: '-createdAt',
    limit: 200,
    depth: 0,
    pagination: false,
    user,
    overrideAccess: false,
  })

  const groupIds = [...new Set(questions.docs.map((q) => relId(q.group)).filter((v): v is number => v != null))]
  const parentIds = [...new Set(questions.docs.map((q) => relId(q.parent)).filter((v): v is number => v != null))]

  const [groups, parents] = await Promise.all([
    groupIds.length
      ? payload
          .find({ collection: 'groups', where: { id: { in: groupIds } }, depth: 0, pagination: false, overrideAccess: true })
          .then((r) => r.docs)
      : Promise.resolve<Group[]>([]),
    parentIds.length
      ? payload
          .find({ collection: 'users', where: { id: { in: parentIds } }, depth: 0, pagination: false, overrideAccess: true })
          .then((r) => r.docs)
      : Promise.resolve<User[]>([]),
  ])
  const groupNameById = new Map(groups.map((g) => [g.id, g.name]))
  const parentById = new Map(parents.map((p) => [p.id, p]))

  const items: QuestionItem[] = questions.docs.map((q) => {
    const parent = parentById.get(relId(q.parent) ?? -1)
    return {
      id: q.id,
      status: q.status,
      groupName: groupNameById.get(relId(q.group) ?? -1) ?? null,
      parentName: parent?.name || parent?.email || 'Родитель',
      parentPhone: parent?.phone ?? null,
      body: q.body,
      createdAt: q.createdAt ?? null,
    }
  })

  return (
    <AppShell title="Вопросы родителей" tabs={COACH_TABS} active="questions">
      <CoachQuestions items={items} />
    </AppShell>
  )
}

export default CoachQuestionsPage
