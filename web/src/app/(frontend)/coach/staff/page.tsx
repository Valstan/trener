import config from '@payload-config'
import type { Metadata } from 'next'
import { headers as nextHeaders } from 'next/headers'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getPayload } from 'payload'
import React from 'react'

import { adminBranchId, isOwner, isPending } from '@/access/roles'
import { loadOwnerBranch } from '@/lib/ownerBranch'
import { relId } from '@/lib/relId'

import { AppShell, staffTabs } from '../../components/AppShell'
import { BranchSwitcher } from '../../components/BranchSwitcher'
import { StaffInviteForm } from './StaffInviteForm'

// Сотрудники школы (п.5 аудита 30.07): список тренеров и администраторов + форма
// приглашения по email. До этого сотрудника заводили только в админке Payload,
// причём с паролем, который владелец придумывал и передавал руками.
export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Сотрудники — Футбольная школа',
}

const ROLE_LABEL: Record<string, string> = {
  owner: 'Владелец сети',
  admin: 'Администратор филиала',
  coach: 'Тренер',
  parent: 'Родитель',
}

const StaffPage = async () => {
  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers: await nextHeaders() })
  if (!user) redirect('/login')
  if (isPending(user)) redirect('/pending')

  const owner = isOwner(user)
  const myBranch = adminBranchId(user)
  // Тренеру здесь делать нечего: он не заводит сотрудников.
  if (!owner && myBranch == null) redirect('/home')

  const { branches, ctx } = await loadOwnerBranch(payload, user)
  const branchFilter = owner ? ctx : Number(myBranch)

  const staff = await payload.find({
    collection: 'users',
    where: {
      and: [
        { roles: { in: ['owner', 'admin', 'coach'] } },
        ...(branchFilter != null ? [{ branch: { equals: branchFilter } }] : []),
      ],
    },
    sort: 'name',
    limit: 200,
    depth: 0,
    pagination: false,
    overrideAccess: true,
  })

  // Группы в скоупе — чтобы сразу назначить приглашённого тренера.
  const groups = await payload.find({
    collection: 'groups',
    sort: 'name',
    limit: 200,
    depth: 0,
    pagination: false,
    where: branchFilter != null ? { branch: { equals: branchFilter } } : {},
    user,
    overrideAccess: false,
  })

  const branchNameById = new Map((branches ?? []).map((b) => [b.id, b.name]))

  return (
    <AppShell title="Сотрудники" tabs={staffTabs(user)} back={{ href: '/home' }}>
      {branches && <BranchSwitcher branches={branches} current={ctx} />}
      {owner && <Link className="btn btn-primary btn-block" href="/coach/child-requests">Заявки самостоятельной регистрации детей →</Link>}

      <p className="muted" style={{ margin: '0 0 1rem' }}>
        Приглашённый получит письмо со ссылкой для входа. Пароль придумывать не нужно —
        он задаст его сам, если захочет.
      </p>

      <StaffInviteForm
        canInviteAdmin={owner}
        branches={owner ? (branches ?? []) : []}
        defaultBranchId={branchFilter}
        groups={groups.docs.map((g) => ({ id: g.id, name: g.name }))}
      />

      <h2 className="section-title">Уже в школе</h2>
      {staff.docs.length === 0 ? (
        <p className="muted">Сотрудников пока нет.</p>
      ) : (
        <div className="stack-sm">
          {staff.docs.map((s) => (
            <article key={s.id} className="card stack-sm">
              <div className="row-between" style={{ alignItems: 'baseline', gap: '0.5rem' }}>
                <strong>{s.name || s.email}</strong>
                <span className="muted small">
                  {(Array.isArray(s.roles) ? s.roles : []).map((r) => ROLE_LABEL[r] ?? r).join(', ')}
                </span>
              </div>
              <div className="muted small">
                {s.email}
                {relId(s.branch) != null ? ` · ${branchNameById.get(relId(s.branch)!) ?? 'филиал'}` : ''}
                {s.status === 'pending' ? ' · ждёт подтверждения' : ''}
              </div>
            </article>
          ))}
        </div>
      )}
    </AppShell>
  )
}

export default StaffPage
