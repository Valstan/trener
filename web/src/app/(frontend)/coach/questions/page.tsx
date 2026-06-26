import config from '@payload-config'
import { headers as nextHeaders } from 'next/headers'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getPayload } from 'payload'
import React from 'react'

import type { Group, User } from '@/payload-types'
import { isAdmin, isCoach } from '@/access/roles'
import { relId } from '@/lib/relId'

import { CoachQuestions, type QuestionItem } from './CoachQuestions'

// Инбокс вопросов тренеру (M3-PR11). Доступ: персонал; читается scoped (тренер — вопросы
// своих групп, #015). Имя/контакт родителя тренеру виден (он ведёт ребёнка) — для ответа
// оффлайн. Вне coverage (F1). Двусторонняя переписка — M4.
export const dynamic = 'force-dynamic'

const container: React.CSSProperties = {
  maxWidth: 640,
  margin: '0 auto',
  padding: '2.5rem 1.25rem 4rem',
  minHeight: '100vh',
}

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
    <main style={container}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '0.75rem' }}>
        <h1 style={{ fontSize: '1.4rem', margin: '0 0 1.25rem' }}>Вопросы родителей</h1>
        <Link href="/coach/schedule" style={{ fontSize: '0.9rem' }}>
          ← Расписание
        </Link>
      </div>
      <CoachQuestions items={items} />
    </main>
  )
}

export default CoachQuestionsPage
