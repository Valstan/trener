import config from '@payload-config'
import { headers as nextHeaders } from 'next/headers'
import { redirect } from 'next/navigation'
import { getPayload } from 'payload'
import React from 'react'

import { adminBranchId, isFullOwner, isOwner } from '@/access/roles'
import { relId } from '@/lib/relId'

import { AppShell, staffTabs } from '../../components/AppShell'
import { AdultRequestRow } from './AdultRequestRow'
import { ChildRequestCard } from './ChildRequestCard'

// Инбокс заявок владельца (#115 доводка): ВСЕ ждущие решения — в одном месте.
// До 09.08 взрослые заявки были видны только в сырой админке Payload (без кнопки
// «одобрить»), а экран детских прятался за /coach/staff и терял заявки, зависшие
// в parent_review (фильтр показывал только owner_review).
export const dynamic = 'force-dynamic'

const REQUEST_ROLE = { parent: 'parent', coach: 'coach' }

const RequestsPage = async () => {
  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers: await nextHeaders() })
  if (!user) redirect('/login')
  if (!isOwner(user)) redirect('/home')

  // Экран читает три коллекции с overrideAccess (инбокс обязан видеть ждущих
  // решения независимо от access-правил), поэтому скоуп держится ЗДЕСЬ.
  // isOwner тут пропускал демо-владельца (roles:['owner'], D-029/#166) ко ВСЕЙ
  // живой сети: email ждущих взрослых, ФИО детей из саморег-заявок и список всех
  // филиалов. Писать он и раньше не мог (decide/route.ts гейтится isFullOwner) —
  // дыра была на чтении. Демо-владелец скоупится своим демо-филиалом, как
  // branch-admin (adminBranchId уже умеет это для demo owner/admin).
  const fullOwner = isFullOwner(user)
  const scopedBranch = fullOwner ? null : adminBranchId(user)
  // Fail-closed: не полный владелец и филиала нет — показывать нечего.
  if (!fullOwner && scopedBranch == null) redirect('/home')
  const branchScope = scopedBranch != null ? [{ branch: { equals: scopedBranch } }] : []

  const [adults, children, branches] = await Promise.all([
    payload.find({
      collection: 'users',
      where: {
        and: [
          { status: { equals: 'pending' } },
          { roles: { in: ['applicant'] } },
          { requestedRole: { in: Object.values(REQUEST_ROLE) } },
          ...branchScope,
        ],
      },
      sort: 'createdAt',
      limit: 200,
      depth: 0,
      pagination: false,
      overrideAccess: true,
    }),
    payload.find({
      collection: 'child-registrations',
      where: { and: [{ status: { in: ['owner_review', 'parent_review'] } }, ...branchScope] },
      sort: 'createdAt',
      limit: 200,
      depth: 1,
      pagination: false,
      overrideAccess: true,
    }),
    payload.find({
      collection: 'branches',
      where: scopedBranch != null ? { id: { equals: scopedBranch } } : {},
      sort: 'name',
      limit: 200,
      depth: 0,
      pagination: false,
      overrideAccess: true,
    }),
  ])

  const branchOptions = branches.docs.map((b) => ({ id: b.id, name: b.name }))

  return (
    <AppShell title="Заявки" tabs={staffTabs(user)} active="requests" back={{ href: '/home' }}>
      <h2 className="section-title">Взрослые</h2>
      {adults.docs.length === 0 ? (
        <p className="muted">Заявок от родителей и тренеров нет.</p>
      ) : (
        <div className="stack-sm">
          {adults.docs.map((a) => (
            <AdultRequestRow
              key={a.id}
              request={{ id: a.id, name: a.name ?? '', email: a.email, requestedRole: a.requestedRole ?? '' }}
              branches={branchOptions}
            />
          ))}
        </div>
      )}

      <h2 className="section-title">Дети</h2>
      {children.docs.length === 0 ? (
        <p className="muted">Детских заявок нет.</p>
      ) : (
        <div className="stack-sm">
          {children.docs.map((r) => {
            const proposed = r.proposedParent
            const proposedParentName =
              typeof proposed === 'object' && proposed !== null
                ? (proposed.name ?? proposed.email ?? `#${relId(proposed)}`)
                : proposed != null
                  ? `#${proposed}`
                  : null
            return (
              <ChildRequestCard
                key={r.id}
                request={{
                  id: r.id,
                  childName: r.childName,
                  dateOfBirth: r.dateOfBirth,
                  parentName: r.parentName,
                  status: r.status as 'owner_review' | 'parent_review',
                  proposedParentName,
                }}
              />
            )
          })}
        </div>
      )}
    </AppShell>
  )
}

export default RequestsPage
