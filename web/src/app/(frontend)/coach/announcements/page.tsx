import config from '@payload-config'
import { headers as nextHeaders } from 'next/headers'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getPayload } from 'payload'
import React from 'react'

import { isAdmin, isCoach } from '@/access/roles'
import { formatDateTime } from '@/lib/notifications/describe'
import { relId } from '@/lib/relId'

import { AnnouncementComposer } from './AnnouncementComposer'

// Объявления тренера: компоновщик (выбор группы + текст + флаг пуша) + список своих
// прошлых объявлений. Доступ: персонал; всё читается scoped (тренер — свои группы, #015).
export const dynamic = 'force-dynamic'

const container: React.CSSProperties = {
  maxWidth: 640,
  margin: '0 auto',
  padding: '2.5rem 1.25rem 4rem',
  minHeight: '100vh',
}

const CoachAnnouncementsPage = async () => {
  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers: await nextHeaders() })
  if (!user) redirect('/login')
  if (!(isCoach(user) || isAdmin(user))) redirect('/')

  // Группы тренера (scoped read) — для селектора адресата.
  const groups = await payload.find({
    collection: 'groups',
    sort: 'name',
    limit: 200,
    pagination: false,
    user,
    overrideAccess: false,
  })
  const groupOptions = groups.docs.map((g) => ({ id: g.id, name: g.name }))

  // Прошлые объявления (scoped read), свежие сверху.
  const announcements = await payload.find({
    collection: 'announcements',
    sort: '-publishedAt',
    limit: 50,
    depth: 0,
    pagination: false,
    user,
    overrideAccess: false,
  })
  const groupNameById = new Map(groupOptions.map((g) => [g.id, g.name]))

  return (
    <main style={container}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '0.75rem' }}>
        <h1 style={{ fontSize: '1.4rem', margin: '0 0 1.25rem' }}>Объявления</h1>
        <Link href="/coach/schedule" style={{ fontSize: '0.9rem' }}>
          ← Расписание
        </Link>
      </div>

      {groupOptions.length === 0 ? (
        <p style={{ color: 'var(--muted)' }}>У вас пока нет групп — объявление отправить некому.</p>
      ) : (
        <AnnouncementComposer groups={groupOptions} />
      )}

      <h2 style={{ fontSize: '1.05rem', margin: '2rem 0 0.75rem' }}>Отправленные</h2>
      {announcements.docs.length === 0 ? (
        <p style={{ color: 'var(--muted)' }}>Объявлений пока нет.</p>
      ) : (
        <div style={{ display: 'grid', gap: '0.6rem' }}>
          {announcements.docs.map((a) => (
            <article
              key={a.id}
              style={{
                padding: '0.85rem 1rem',
                borderRadius: 10,
                border: '1px solid #1f3a2c',
                background: '#11261c',
                display: 'grid',
                gap: '0.3rem',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem' }}>
                <strong>{a.title}</strong>
                <span style={{ color: 'var(--muted)', fontSize: '0.8rem', whiteSpace: 'nowrap' }}>
                  {a.publishedAt ? formatDateTime(a.publishedAt) : ''}
                </span>
              </div>
              <div style={{ color: 'var(--muted)', fontSize: '0.9rem' }}>
                {groupNameById.get(relId(a.group) ?? -1) ?? 'Группа'}
                {a.triggersPush ? ' · 🔔 с пушем' : ''}
              </div>
              <p style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{a.body}</p>
            </article>
          ))}
        </div>
      )}
    </main>
  )
}

export default CoachAnnouncementsPage
