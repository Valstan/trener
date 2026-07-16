import config from '@payload-config'
import { headers as nextHeaders } from 'next/headers'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getPayload } from 'payload'
import React from 'react'

import { isParent } from '@/access/roles'
import { relId } from '@/lib/relId'

import { AppShell, PARENT_TABS } from '../../components/AppShell'
import { QuestionForm } from '../QuestionForm'

// Вкладка «Вопрос» родителя: одно сообщение тренеру по группе своих детей (суррогат
// чата, M3-PR11; двусторонняя переписка — M4). Группы берём от детей родителя.
export const dynamic = 'force-dynamic'

const ParentAskPage = async () => {
  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers: await nextHeaders() })
  if (!user) redirect('/login')
  if (!isParent(user)) redirect('/')

  const myPlayers = await payload.find({
    collection: 'players',
    where: { parent: { equals: user.id } },
    depth: 0,
    limit: 200,
    pagination: false,
    overrideAccess: true,
  })
  const myGroupIds = [...new Set(myPlayers.docs.map((p) => relId(p.group)).filter((v): v is number => v != null))]
  const myGroups = myGroupIds.length
    ? (
        await payload.find({
          collection: 'groups',
          where: { id: { in: myGroupIds } },
          sort: 'name',
          depth: 0,
          pagination: false,
          overrideAccess: true,
        })
      ).docs.map((g) => ({ id: g.id, name: g.name }))
    : []

  // Нитки родителя (M4): свои вопросы с бейджем статуса — вход в переписку.
  const myQuestions = await payload.find({
    collection: 'questions',
    where: { parent: { equals: user.id } },
    sort: '-createdAt',
    depth: 0,
    limit: 50,
    pagination: false,
    overrideAccess: true,
  })
  const groupNameById = new Map(myGroups.map((g) => [g.id, g.name]))
  const statusLabel: Record<string, string> = {
    new: 'Отправлен',
    read: 'Тренер прочитал',
    answered: 'Тренер ответил',
  }

  return (
    <AppShell title="Вопрос тренеру" tabs={PARENT_TABS} active="ask">
      <p className="muted" style={{ margin: '0 0 1.25rem' }}>
        Напишите тренеру — он увидит сообщение и свяжется с вами.
      </p>
      {myGroups.length === 0 ? (
        <div className="empty-state">
          <span className="ic" aria-hidden>
            💬
          </span>
          Пока некому написать — нет привязанной группы.
        </div>
      ) : (
        <QuestionForm groups={myGroups} />
      )}

      {myQuestions.docs.length > 0 && (
        <>
          <h2 className="section-title">Мои переписки</h2>
          <div className="stack-sm">
            {myQuestions.docs.map((q) => (
              <Link
                key={q.id}
                href={`/parent/ask/${q.id}`}
                className={q.status === 'answered' ? 'card card-accent stack-xs' : 'card stack-xs'}
                style={{ textDecoration: 'none', color: 'inherit' }}
              >
                <div className="row-between" style={{ alignItems: 'baseline' }}>
                  <span className={q.status === 'answered' ? 'badge badge-warn' : 'badge'}>
                    {statusLabel[q.status] ?? q.status}
                  </span>
                  <span className="muted small">{groupNameById.get(relId(q.group) ?? -1) ?? ''}</span>
                </div>
                <p className="pre muted" style={{ margin: 0, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                  {q.body}
                </p>
              </Link>
            ))}
          </div>
        </>
      )}
    </AppShell>
  )
}

export default ParentAskPage
