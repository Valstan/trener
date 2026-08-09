import config from '@payload-config'
import type { Metadata } from 'next'
import { headers as nextHeaders } from 'next/headers'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getPayload } from 'payload'
import React from 'react'

import { hasRole, isPending } from '@/access/roles'
import { SALES_CONTACTS } from '@/lib/salesContacts'

import { SectionCards, sectionsForRoles } from '../components/SectionCards'

// Экран ожидания модерации (M5 PR-B): самореги видят его до подтверждения
// владельцем/админом филиала. Подтверждённого (или гостя) уводим по назначению.
// Approved-applicant (одобрен, но роль не назначена) тоже остаётся здесь — редирект
// на refresh-session уводил его в петлю лендинга.
export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Заявка на рассмотрении — Футбольная школа',
}

const PendingPage = async () => {
  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers: await nextHeaders() })
  if (!user) redirect('/login')
  const freshUser = await payload.findByID({ collection: 'users', id: user.id, depth: 0, overrideAccess: true })
  if (!isPending(freshUser) && !hasRole(freshUser, 'applicant')) redirect('/auth/refresh-session')
  if (!freshUser.requestedRole) redirect('/onboarding/role')

  // Отклонённая детская заявка: сказать прямо и дать дорогу назад (иначе вечный
  // «передаётся родителю» — заявка отклонена, а ребёнок об этом не узнаёт).
  const childRegistration =
    freshUser.requestedRole === 'child'
      ? (
          await payload.find({
            collection: 'child-registrations',
            where: { account: { equals: freshUser.id } },
            limit: 1,
            depth: 0,
            pagination: false,
            overrideAccess: true,
          })
        ).docs[0]
      : undefined
  const childRejected = childRegistration?.status === 'rejected'

  // Превью разделов — по ЗАПРОШЕННОЙ роли (будущему тренеру раньше показывали
  // родительские «Оплата» и «Вопрос тренеру» под замком — сбивало с толку).
  const previewSections =
    freshUser.requestedRole === 'coach'
      ? sectionsForRoles({ roles: ['coach'] })
      : freshUser.requestedRole === 'parent'
        ? sectionsForRoles({ roles: ['parent'] })
        : null

  const phone = SALES_CONTACTS.find((c) => c.href?.startsWith('tel:'))

  return (
    <main className="page" style={{ maxWidth: 460, textAlign: 'center' }}>
      <div aria-hidden style={{ fontSize: '3rem', padding: '2.5rem 0 1rem' }}>
        ⏳
      </div>
      <h1 style={{ fontSize: '1.6rem', margin: '0 0 0.5rem' }}>
        {childRejected ? 'Заявка отклонена' : 'Заявка на рассмотрении'}
      </h1>
      <p style={{ color: 'var(--muted)', margin: '0 0 1.5rem' }}>
        {childRejected ? (
          <>
            Владелец школы отклонил заявку — чаще всего из-за неточных данных.{' '}
            <Link href="/onboarding/child">Проверьте и отправьте снова →</Link>
          </>
        ) : freshUser.requestedRole === 'child' ? (
          'Заявка передаётся указанному родителю. После его подтверждения тренер назначит вам группу.'
        ) : (
          'Доступ к разделам откроется после того, как администрация школы подтвердит вашу регистрацию и назначит филиал.'
        )}
      </p>
      <div className="card card-muted" style={{ textAlign: 'left' }}>
        <strong style={{ display: 'block', marginBottom: '0.35rem' }}>Что дальше?</strong>
        <span style={{ color: 'var(--muted)', fontSize: '0.9rem' }}>
          {freshUser.requestedRole === 'child'
            ? 'Попросите родителя проверить раздел «Аккаунт» в приложении.'
            : 'Сообщите администрации школы, что завершили самостоятельную регистрацию — так заявку рассмотрят быстрее.'}
        </span>
        {freshUser.requestedRole !== 'child' && phone && (
          <span style={{ display: 'block', color: 'var(--muted)', fontSize: '0.9rem', marginTop: '0.5rem' }}>
            Не отвечают? Свяжитесь с платформой: <a href={phone.href!}>{phone.value}</a>.
          </span>
        )}
      </div>
      {/* M7: плашки разделов видны, но под замком до подтверждения (видение v2 §2). */}
      {previewSections && (
        <div style={{ textAlign: 'left', marginTop: '1.5rem' }}>
          <SectionCards sections={previewSections} locked />
        </div>
      )}
      <p className="note" style={{ marginTop: '1.5rem' }}>
        <Link href="/">← На главную</Link>
      </p>
    </main>
  )
}

export default PendingPage
