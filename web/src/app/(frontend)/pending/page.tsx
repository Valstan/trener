import config from '@payload-config'
import type { Metadata } from 'next'
import { headers as nextHeaders } from 'next/headers'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getPayload } from 'payload'
import React from 'react'

import { isPending } from '@/access/roles'
import { homePathForUser } from '@/lib/auth/home'

import { SectionCards, sectionsForRoles } from '../components/SectionCards'

// Экран ожидания модерации (M5 PR-B): самореги видят его до подтверждения
// владельцем/админом филиала. Подтверждённого (или гостя) уводим по назначению.
export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Заявка на рассмотрении — Футбольная школа',
}

const PendingPage = async () => {
  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers: await nextHeaders() })
  if (!user) redirect('/login')
  if (!isPending(user)) redirect(homePathForUser(user))

  return (
    <main className="page" style={{ maxWidth: 460, textAlign: 'center' }}>
      <div aria-hidden style={{ fontSize: '3rem', padding: '2.5rem 0 1rem' }}>
        ⏳
      </div>
      <h1 style={{ fontSize: '1.6rem', margin: '0 0 0.5rem' }}>Заявка на рассмотрении</h1>
      <p style={{ color: 'var(--muted)', margin: '0 0 1.5rem' }}>
        Вы вошли, но доступ к разделам откроется после того, как администратор школы
        подтвердит ваше участие и укажет вашу роль. Обычно это занимает немного времени.
      </p>
      <div className="card card-muted" style={{ textAlign: 'left' }}>
        <strong style={{ display: 'block', marginBottom: '0.35rem' }}>Что дальше?</strong>
        <span style={{ color: 'var(--muted)', fontSize: '0.9rem' }}>
          Если вы родитель — сообщите тренеру, что зарегистрировались: он свяжет вас с вашим
          ребёнком, и вам откроются расписание и уведомления группы.
        </span>
      </div>
      {/* M7: плашки разделов видны, но под замком до подтверждения (видение v2 §2). */}
      <div style={{ textAlign: 'left', marginTop: '1.5rem' }}>
        <SectionCards sections={sectionsForRoles(user)} locked />
      </div>
      <p className="note" style={{ marginTop: '1.5rem' }}>
        <Link href="/">← На главную</Link>
      </p>
    </main>
  )
}

export default PendingPage
