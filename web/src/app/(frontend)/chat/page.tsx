import config from '@payload-config'
import type { Metadata } from 'next'
import { headers as nextHeaders } from 'next/headers'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getPayload } from 'payload'
import React from 'react'

import { adminBranchId, isCoach, isOwner, isParent, isPending } from '@/access/roles'
import { relId } from '@/lib/relId'

import { AppShell, COACH_TABS, PARENT_TABS, type Tab } from '../components/AppShell'
import { TopicComposer } from './TopicComposer'

// Список тем общих комнат (M9, видение v2 §3.3). Комната = группа: тренеры группы +
// родители её детей. Родитель видит комнаты групп своих детей, тренер — своих групп,
// владелец — все (в контексте выбранного филиала это сузит сам scoped-read).
export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Чат — Футбольная школа',
}

const fmtWhen = (iso: string | null | undefined): string => {
  if (!iso) return 'пока пусто'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return 'пока пусто'
  return d.toLocaleString('ru-RU', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })
}

const ChatPage = async () => {
  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers: await nextHeaders() })
  if (!user) redirect('/login')
  if (isPending(user)) redirect('/pending')

  const parentOnly = isParent(user) && !isCoach(user) && !isOwner(user)
  const tabs: Tab[] = parentOnly ? PARENT_TABS : COACH_TABS
  const canStartTopic = isOwner(user) || adminBranchId(user) != null || isCoach(user)

  // Темы в скоупе (scoped read сам ограничит видимость). Свежие — сверху; тема без
  // сообщений всё равно должна быть видна, поэтому вторая сортировка по созданию.
  const topics = await payload.find({
    collection: 'chat-topics',
    sort: ['-lastMessageAt', '-createdAt'],
    limit: 200,
    depth: 0,
    pagination: false,
    user,
    overrideAccess: false,
  })

  // Мои отметки прочтения. Одним запросом на весь список: «есть новое» = у темы
  // lastMessageAt свежее моего lastReadAt. Считать непрочитанные ШТУКАМИ значило бы
  // тянуть сами сообщения — на 1 vCPU это лишняя работа ради цифры, которую всё
  // равно читают как «есть или нет».
  const reads = await payload.find({
    collection: 'chat-reads',
    where: { user: { equals: user.id } },
    limit: 500,
    depth: 0,
    pagination: false,
    user,
    overrideAccess: false,
  })
  const readAtByTopic = new Map(
    reads.docs.map((r) => [relId(r.topic) ?? -1, r.lastReadAt ? Date.parse(r.lastReadAt) : 0]),
  )
  const hasNews = (t: { id: number; lastMessageAt?: string | null }): boolean => {
    if (!t.lastMessageAt) return false
    const last = Date.parse(t.lastMessageAt)
    if (Number.isNaN(last)) return false
    // Темы, которую не открывали ни разу, отметки нет → всё, что в ней есть, новое.
    return last > (readAtByTopic.get(t.id) ?? 0)
  }

  // Названия групп — служебно (G90): сами группы читаются под ролью, но нам нужен
  // только их заголовок для подписи темы.
  const groupIds = [...new Set(topics.docs.map((t) => relId(t.group)).filter((v): v is number => v != null))]
  const groupNameById = new Map(
    groupIds.length
      ? (
          await payload.find({
            collection: 'groups',
            where: { id: { in: groupIds } },
            depth: 0,
            pagination: false,
            overrideAccess: true,
          })
        ).docs.map((g) => [g.id, g.name])
      : [],
  )

  // Группы, где можно завести тему (только персонал и только свои).
  const ownGroups = canStartTopic
    ? (
        await payload.find({
          collection: 'groups',
          sort: 'name',
          limit: 200,
          depth: 0,
          pagination: false,
          user,
          overrideAccess: false,
        })
      ).docs.map((g) => ({ id: g.id, name: g.name }))
    : []

  const newsCount = topics.docs.filter((t) => hasNews(t)).length

  return (
    <AppShell title="Чат" tabs={tabs} active="chat">
      <p className="muted" style={{ margin: '0 0 1rem' }}>
        Общий разговор группы: тренеры и родители. Личный вопрос тренеру — в разделе «Вопрос».
      </p>

      {canStartTopic && ownGroups.length > 0 && <TopicComposer groups={ownGroups} />}

      {newsCount > 0 && (
        <p className="muted small" style={{ margin: '0 0 0.75rem' }}>
          Новое в {newsCount === 1 ? 'одной теме' : `${newsCount} темах`}.
        </p>
      )}

      {topics.docs.length === 0 ? (
        <div className="empty-state">
          <span className="ic" aria-hidden>
            👥
          </span>
          {canStartTopic
            ? 'Тем пока нет. Заведите первую — например, «Едем на соревнования».'
            : 'Тем пока нет. Их заводит тренер группы.'}
        </div>
      ) : (
        <div className="stack-sm">
          {topics.docs.map((t) => (
            <Link key={t.id} href={`/chat/${t.id}`} className="card row" style={{ alignItems: 'flex-start' }}>
              <span aria-hidden style={{ fontSize: '1.4rem', lineHeight: 1.2 }}>
                {t.closed ? '🔒' : '💬'}
              </span>
              <div style={{ minWidth: 0 }}>
                <strong style={{ display: 'block', marginBottom: '0.15rem' }}>
                  {t.title}
                  {hasNews(t) && (
                    <span className="badge badge-ok" style={{ marginLeft: '0.4rem' }}>
                      новое
                    </span>
                  )}
                </strong>
                <span className="muted small">
                  {groupNameById.get(relId(t.group) ?? -1) ?? 'Группа'} · {fmtWhen(t.lastMessageAt)}
                  {t.closed ? ' · закрыта' : ''}
                </span>
              </div>
              <span style={{ marginLeft: 'auto', color: 'var(--faint)' }}>›</span>
            </Link>
          ))}
        </div>
      )}
    </AppShell>
  )
}

export default ChatPage
