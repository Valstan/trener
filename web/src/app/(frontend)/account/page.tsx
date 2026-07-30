import config from '@payload-config'
import { headers as nextHeaders } from 'next/headers'
import { redirect } from 'next/navigation'
import { getPayload } from 'payload'
import React from 'react'

import { isCoach, isParent, isPending } from '@/access/roles'

import { AppShell, COACH_TABS, PARENT_TABS, type Tab } from '../components/AppShell'
import { ServicesCatalogLink } from '../components/ServicesCatalogLink'
import { AccountForm } from './AccountForm'
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
  const tabs: Tab[] = isParent(user) && !isCoach(user) ? PARENT_TABS : COACH_TABS

  return (
    <AppShell title="Аккаунт" tabs={tabs} active="account" back={{ href: '/', label: 'Назад' }}>
      <AccountForm email={user.email} />

      <h2 className="section-title">Другие сервисы города</h2>
      <p className="muted small" style={{ marginTop: 0 }}>
        Общий каталог сайтов Малмыжа — вход туда тот же, что и сюда.
      </p>
      <ServicesCatalogLink />

      <h2 className="section-title">Выход</h2>
      <p className="muted small" style={{ marginTop: 0 }}>
        Пригодится, если телефон общий на семью или нужно войти под другим аккаунтом.
      </p>
      <LogoutButton />
    </AppShell>
  )
}

export default AccountPage
