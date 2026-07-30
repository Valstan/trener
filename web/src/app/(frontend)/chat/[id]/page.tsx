import config from '@payload-config'
import { headers as nextHeaders } from 'next/headers'
import { notFound, redirect } from 'next/navigation'
import { getPayload } from 'payload'
import React from 'react'

import { isCoach, isOwner, isParent, isPending } from '@/access/roles'
import { relId } from '@/lib/relId'

import { AppShell, COACH_TABS, PARENT_TABS, type Tab } from '../../components/AppShell'
import { MessageComposer } from './MessageComposer'

// Тема комнаты: лента сообщений + форма ответа (M9). Тему читаем ПОД ролью
// (overrideAccess:false) — не участник просто не найдёт её, отдельной проверки
// «а можно ли» не нужно.
export const dynamic = 'force-dynamic'

const ROLE_LABEL: Record<string, string> = {
  coach: 'Тренер',
  staff: 'Администрация школы',
  parent: 'Родитель',
}

const fmtWhen = (iso: string | null | undefined): string => {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleString('ru-RU', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })
}

const TopicPage = async ({ params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params
  const topicId = Number(id)
  if (!Number.isInteger(topicId) || topicId <= 0) notFound()

  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers: await nextHeaders() })
  if (!user) redirect('/login')
  if (isPending(user)) redirect('/pending')

  let topic
  try {
    topic = await payload.findByID({
      collection: 'chat-topics',
      id: topicId,
      depth: 0,
      user,
      overrideAccess: false,
    })
  } catch {
    notFound()
  }
  if (!topic) notFound()

  const messages = await payload.find({
    collection: 'chat-messages',
    where: { topic: { equals: topic.id } },
    sort: 'createdAt',
    limit: 500,
    depth: 0,
    pagination: false,
    user,
    overrideAccess: false,
  })

  const groupId = relId(topic.group)
  const group =
    groupId != null
      ? await payload.findByID({ collection: 'groups', id: groupId, depth: 0, overrideAccess: true })
      : null

  const parentOnly = isParent(user) && !isCoach(user) && !isOwner(user)
  const tabs: Tab[] = parentOnly ? PARENT_TABS : COACH_TABS

  return (
    <AppShell title={topic.title} tabs={tabs} back={{ href: '/chat', label: 'К темам' }}>
      <p className="muted small" style={{ margin: '0 0 1rem' }}>
        {group?.name ?? 'Группа'}
        {topic.closed ? ' · тема закрыта' : ''}
      </p>

      {messages.docs.length === 0 ? (
        <div className="empty-state">
          <span className="ic" aria-hidden>
            💬
          </span>
          Здесь пока пусто. Напишите первым.
        </div>
      ) : (
        <div className="stack-sm">
          {messages.docs.map((m) => {
            const mine = relId(m.author) === user.id
            return (
              <article
                key={m.id}
                className={mine ? 'card card-accent stack-sm' : 'card stack-sm'}
                style={{ marginLeft: mine ? '1.5rem' : 0, marginRight: mine ? 0 : '1.5rem' }}
              >
                <div className="row-between" style={{ alignItems: 'baseline', gap: '0.5rem' }}>
                  <strong className="small">{m.authorName || 'Участник'}</strong>
                  <span className="muted small">
                    {ROLE_LABEL[m.authorRole ?? ''] ?? ''} · {fmtWhen(m.createdAt)}
                  </span>
                </div>
                <p className="pre" style={{ margin: 0 }}>
                  {m.body}
                </p>
              </article>
            )
          })}
        </div>
      )}

      {topic.closed ? (
        <p className="muted" style={{ marginTop: '1rem' }}>
          Тема закрыта — написать в неё нельзя.
        </p>
      ) : (
        <MessageComposer topicId={topic.id} />
      )}
    </AppShell>
  )
}

export default TopicPage
