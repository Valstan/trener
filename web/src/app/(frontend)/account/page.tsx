import config from '@payload-config'
import { headers as nextHeaders } from 'next/headers'
import { redirect } from 'next/navigation'
import { getPayload } from 'payload'
import React from 'react'

import { isChild, isCoach, isParent, isPending } from '@/access/roles'
import { ECOSYSTEM_CITY } from '@/lib/ecosystem'
import { relId } from '@/lib/relId'

import { AppShell, CHILD_TABS, COACH_TABS, PARENT_TABS, type Tab } from '../components/AppShell'
import { AuthorCredit } from '../components/AuthorCredit'
import { ServicesCatalogLink } from '../components/ServicesCatalogLink'
import { AccountForm } from './AccountForm'
import { ChildAccounts } from './ChildAccounts'
import { ChildApprovalRequests } from './ChildApprovalRequests'
import { LogoutButton } from './LogoutButton'

// Экран «Аккаунт» любого вошедшего: логин (email) + установка постоянного пароля.
// Кросс-ролевой — набор табов подбираем по роли, чтобы нижняя навигация не пропадала.
export const dynamic = 'force-dynamic'

const AccountPage = async () => {
  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers: await nextHeaders() })
  if (!user) redirect('/login')
  if (isPending(user)) redirect('/pending')

  // Таб-бар по роли (админ работает в staff-оболочке тренера).
  const tabs: Tab[] = isChild(user) ? CHILD_TABS : isParent(user) && !isCoach(user) ? PARENT_TABS : COACH_TABS

  // Каталог сервисов — городской, а сеть межгородская: показываем только своим.
  // Владелец сети филиала не имеет — ему показываем (он в городе экосистемы).
  // Служебный find (G90): филиал читаем с overrideAccess.
  const branchId = relId(user.branch)
  const branch =
    branchId != null
      ? await payload.findByID({ collection: 'branches', id: branchId, depth: 0, overrideAccess: true })
      : null
  const showCityServices = branch == null || branch.city === ECOSYSTEM_CITY

  const children = isParent(user)
    ? (await payload.find({ collection: 'players', depth: 1, limit: 100, pagination: false, user, overrideAccess: false })).docs
    : []
  const childRequests = isParent(user) ? (await payload.find({ collection: 'child-registrations', where: { status: { equals: 'parent_review' } }, sort: 'createdAt', limit: 100, pagination: false, depth: 0, user, overrideAccess: false })).docs : []

  return (
    <AppShell title="Аккаунт" tabs={tabs} active="account" back={{ href: '/', label: 'Назад' }}>
      <AccountForm email={user.email} />

      {isParent(user) && (
        <>
          <ChildApprovalRequests requests={childRequests.map((request) => ({ id: request.id, childName: request.childName, dateOfBirth: request.dateOfBirth }))} />
          <h2 className="section-title">Аккаунты детей</h2>
          <ChildAccounts players={children.map((child) => ({
            id: child.id,
            name: child.name,
            dateOfBirth: child.dateOfBirth,
            login: typeof child.account === 'object' && child.account ? child.account.login : null,
            hasAccount: child.account != null,
          }))} />
        </>
      )}

      {showCityServices && (
        <>
          <h2 className="section-title">Другие сервисы города</h2>
          <p className="muted small" style={{ marginTop: 0 }}>
            Общий каталог сайтов Малмыжа — вход туда тот же, что и сюда.
          </p>
          <ServicesCatalogLink />
        </>
      )}

      <h2 className="section-title">Выход</h2>
      <p className="muted small" style={{ marginTop: 0 }}>
        Пригодится, если телефон общий на семью или нужно войти под другим аккаунтом.
      </p>
      <LogoutButton />

      <div style={{ marginTop: '1.75rem', textAlign: 'center', fontSize: '0.85rem' }}>
        <AuthorCredit />
      </div>
    </AppShell>
  )
}

export default AccountPage
