import config from '@payload-config'
import { headers as nextHeaders } from 'next/headers'
import { notFound, redirect } from 'next/navigation'
import { getPayload } from 'payload'
import React from 'react'

import { isParent } from '@/access/roles'
import { relId } from '@/lib/relId'

import { AppShell, PARENT_TABS } from '../../../components/AppShell'
import { ReplyForm } from '../../../components/ReplyForm'
import { ThreadMessages, type ThreadMessage } from '../../../components/ThreadMessages'

// Нитка чата M4 глазами родителя: его вопрос + ответы тренера + форма реплики.
// #015: родитель видит ТОЛЬКО свои нитки (question.parent === user, 404 без различения).
export const dynamic = 'force-dynamic'

const ParentThreadPage = async ({ params }: { params: Promise<{ id: string }> }) => {
  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers: await nextHeaders() })
  if (!user) redirect('/login')
  if (!isParent(user)) redirect('/')

  const { id } = await params
  const questionId = Number(id)
  if (!Number.isInteger(questionId)) notFound()

  const question = await payload
    .findByID({ collection: 'questions', id: questionId, depth: 0, overrideAccess: true })
    .catch(() => null)
  if (!question || relId(question.parent) !== user.id) notFound()

  const [group, replies] = await Promise.all([
    relId(question.group) != null
      ? payload
          .findByID({ collection: 'groups', id: relId(question.group)!, depth: 0, overrideAccess: true })
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

  const messages: ThreadMessage[] = [
    {
      id: 'head',
      authorRole: 'parent' as const,
      authorName: user.name ?? 'Вы',
      body: question.body,
      createdAt: question.createdAt ?? null,
    },
    ...replies.docs.map((m) => {
      const author = typeof m.author === 'object' && m.author !== null ? m.author : null
      return {
        id: String(m.id),
        authorRole: m.authorRole,
        authorName: m.authorRole === 'coach' ? (author?.name ?? 'Тренер') : (user.name ?? 'Вы'),
        body: m.body,
        createdAt: m.createdAt ?? null,
      }
    }),
  ]

  return (
    <AppShell title="Переписка с тренером" back={{ href: '/parent/ask' }} tabs={PARENT_TABS} active="ask">
      <p className="muted" style={{ margin: '0 0 1rem' }}>{group?.name ?? 'Группа'}</p>
      <ThreadMessages messages={messages} />
      <h2 className="section-title">Написать ещё</h2>
      <ReplyForm action={`/parent/question/${questionId}/reply`} placeholder="Сообщение тренеру" />
    </AppShell>
  )
}

export default ParentThreadPage
