import config from '@payload-config'
import type { Metadata } from 'next'
import { headers as nextHeaders } from 'next/headers'
import { redirect } from 'next/navigation'
import { getPayload } from 'payload'
import type { Where } from 'payload'
import React from 'react'

import { adminBranchId, hasRole, isFullOwner, isPending } from '@/access/roles'
import { relId } from '@/lib/relId'

import { AppShell, staffTabs } from '../../components/AppShell'
import { ImportForm } from './ImportForm'

// Массовый импорт детей (п.6 аудита): «вставил список из Excel → предпросмотр →
// Применить → таблица ссылок-приглашений» за 2 минуты вместо 100 ручных созданий
// в админке. Видят те же роли, что создают players (owner/admin/coach), сервер
// дополнительно скоупит группы по роли.
export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Импорт детей — Футбольная школа',
}

const ImportPage = async () => {
  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers: await nextHeaders() })
  if (!user) redirect('/login')
  if (isPending(user)) redirect('/pending')
  if (!hasRole(user, 'owner', 'admin', 'coach')) redirect('/home')

  // isFullOwner, не isOwner (D-029/#166): демо-владельцу селект филиалов сети не
  // показываем — иначе витрина перечисляет живые филиалы и группы.
  const owner = isFullOwner(user)
  const myBranch = adminBranchId(user)

  // Владельцу — селект филиала (имена групп могут повторяться между филиалами).
  const branches = owner
    ? (
        await payload.find({
          collection: 'branches',
          sort: 'name',
          limit: 200,
          depth: 0,
          pagination: false,
          overrideAccess: true,
        })
      ).docs.map((b) => ({ id: b.id, name: b.name }))
    : null

  // Группы скоупа вызывающего — те же правила применит сервер при импорте:
  // owner — все (клиент фильтрует по выбранному филиалу), админ — свой филиал,
  // тренер — только свои. Директор сразу видит, как писать имена групп в списке.
  const where: Where = owner
    ? {}
    : myBranch != null
      ? { branch: { equals: myBranch } }
      : { coaches: { in: [user.id] } }
  const groups = await payload.find({
    collection: 'groups',
    where,
    sort: 'name',
    limit: 1000,
    depth: 0,
    pagination: false,
    overrideAccess: true,
  })

  return (
    <AppShell title="Импорт детей" tabs={staffTabs(user)} active="import" back={{ href: '/home' }}>
      <p className="muted" style={{ margin: '0 0 1rem' }}>
        Вставьте список из Excel: имя ребёнка, группа и — по желанию — email родителя.
        Сохраняются только имя и группа, всё лишнее отбрасывается.
      </p>

      <ImportForm
        branches={branches}
        groups={groups.docs.map((g) => ({ id: g.id, name: g.name, branchId: relId(g.branch) }))}
      />
    </AppShell>
  )
}

export default ImportPage
