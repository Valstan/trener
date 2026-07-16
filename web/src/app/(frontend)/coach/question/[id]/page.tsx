import config from '@payload-config'
import { headers as nextHeaders } from 'next/headers'
import { notFound, redirect } from 'next/navigation'
import { getPayload } from 'payload'
import React from 'react'

import { coachGroupIds, isAdmin, isCoach } from '@/access/roles'
import { relId } from '@/lib/relId'

import { AppShell, COACH_TABS } from '../../../components/AppShell'
import { ReplyForm } from '../../../components/ReplyForm'
import { ThreadMessages, type ThreadMessage } from '../../../components/ThreadMessages'

// Нитка чата M4 глазами тренера: голова (вопрос родителя) + реплики + форма ответа.
// #015: тренер видит ТОЛЬКО нитки своих групп (проверка владения, 404 без различения).
export const dynamic = 'force-dynamic'

const CoachThreadPage = async ({ params }: { params: Promise<{ id: string }> }) => {
  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers: await nextHeaders() })
  if (!user) redirect('/login')
  if (!(isCoach(user) || isAdmin(user))) redirect('/')

  const { id } = await params
  const questionId = Number(id)
  if (!Number.isInteger(questionId)) notFound()

  const question = await payload
    .findByID({ collection: 'questions', id: questionId, depth: 0, overrideAccess: true })
    .catch(() => null)
  if (!question) notFound()

  const groupId = relId(question.group)
  if (!isAdmin(user)) {
    const groupIds = await coachGroupIds({ payload } as never, user.id)
    if (!groupIds.includes(groupId ?? -1)) notFound()
  }

  const [group, parent, replies] = await Promise.all([
    groupId != null
      ? payload.findByID({ collection: 'groups', id: groupId, depth: 0, overrideAccess: true }).catch(() => null)
      : null,
    relId(question.parent) != null
      ? payload
          .findByID({ collection: 'users', id: relId(question.parent)!, depth: 0, overrideAccess: true })
          .catch(() => null)
      : null,
    payload.find({
      collection: 'question-messages',
      where: { question: { equals: questionId } },
      sort: 'createdAt',
      depth: 1,
      limit: 500,
      pagination: false,
      overrideAccess: true,
    }),
  ])

  const parentName = parent?.name ?? 'Родитель'
  const messages: ThreadMessage[] = [
    {
      id: 'head',
      authorRole: 'parent' as const,
      authorName: parentName,
      body: question.body,
      createdAt: question.createdAt ?? null,
    },
    ...replies.docs.map((m) => {
      const author = typeof m.author === 'object' && m.author !== null ? m.author : null
      return {
        id: String(m.id),
        authorRole: m.authorRole,
        authorName: author?.name ?? (m.authorRole === 'coach' ? 'Тренер' : parentName),
        body: m.body,
        createdAt: m.createdAt ?? null,
      }
    }),
  ]

  return (
    <AppShell title="Переписка" back={{ href: '/coach/questions' }} tabs={COACH_TABS} active="questions">
      <p className="muted" style={{ margin: '0 0 1rem' }}>
        {parentName}
        {parent?.phone ? ` · ${parent.phone}` : ''} · {group?.name ?? 'Группа'}
      </p>
      <ThreadMessages messages={messages} />
      <h2 className="section-title">Ответить</h2>
      <ReplyForm action={`/coach/question/${questionId}/reply`} placeholder="Ответ родителю" />
    </AppShell>
  )
}

export default CoachThreadPage
