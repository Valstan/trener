import config from '@payload-config'
import { headers as nextHeaders } from 'next/headers'
import { redirect } from 'next/navigation'
import { getPayload } from 'payload'
import React from 'react'

import { isCoach, isParent } from '@/access/roles'

import { AppShell, COACH_TABS, PARENT_TABS, type Tab } from '../components/AppShell'
import { AccountForm } from './AccountForm'

// Экран «Аккаунт» любого вошедшего: логин (email) + установка постоянного пароля.
// Кросс-ролевой — набор табов подбираем по роли, чтобы нижняя навигация не пропадала.
export const dynamic = 'force-dynamic'

const AccountPage = async () => {
  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers: await nextHeaders() })
  if (!user) redirect('/login')

  // Таб-бар по роли (админ работает в staff-оболочке тренера).
  const tabs: Tab[] = isParent(user) && !isCoach(user) ? PARENT_TABS : COACH_TABS

  return (
    <AppShell title="Аккаунт" tabs={tabs} active="account" back={{ href: '/', label: 'Назад' }}>
      <AccountForm email={user.email} />
    </AppShell>
  )
}

export default AccountPage
