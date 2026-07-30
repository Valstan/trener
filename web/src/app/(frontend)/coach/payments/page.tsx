import config from '@payload-config'
import { headers as nextHeaders } from 'next/headers'
import { redirect } from 'next/navigation'
import { getPayload } from 'payload'
import React from 'react'

import { adminBranchId, isCoach, isOwner, isPending } from '@/access/roles'
import { loadOwnerBranch } from '@/lib/ownerBranch'
import { relId } from '@/lib/relId'
import { STATUS_VIEW, subscriptionStatus } from '@/lib/subscriptionStatus'

import { AppShell, COACH_TABS } from '../../components/AppShell'
import { BranchSwitcher } from '../../components/BranchSwitcher'
import { PaymentForm } from './PaymentForm'

// Раздел «Оплата» персонала (M8): таблица абонементов по детям (актуальная запись
// = максимальный paidUntil) + форма записи оплаты. Запись — владелец и админ
// филиала; тренер видит своих (read-only). Деньги через приложение не ходят.
export const dynamic = 'force-dynamic'

const fmtDate = (iso: string | null | undefined): string => {
  if (!iso) return '—'
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })
}

const CoachPaymentsPage = async () => {
  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers: await nextHeaders() })
  if (!user) redirect('/login')
  if (isPending(user)) redirect('/pending')
  const canWrite = isOwner(user) || adminBranchId(user) != null
  if (!(canWrite || isCoach(user))) redirect('/')

  // Контекст филиала владельца (M5 PR-D) — сужает группы/детей.
  const { branches, ctx, ctxGroupIds } = await loadOwnerBranch(payload, user)

  // Группы в скоупе (scoped read) → дети этих групп.
  const groups = await payload.find({
    collection: 'groups',
    sort: 'name',
    limit: 200,
    depth: 0,
    pagination: false,
    where: ctx != null ? { branch: { equals: ctx } } : {},
    user,
    overrideAccess: false,
  })
  const groupNameById = new Map(groups.docs.map((g) => [g.id, g.name]))
  const players = await payload.find({
    collection: 'players',
    sort: 'name',
    limit: 1000,
    depth: 0,
    pagination: false,
    where: ctxGroupIds ? { group: { in: ctxGroupIds } } : {},
    user,
    overrideAccess: false,
  })

  // Абонементы (scoped read): актуальная запись на ребёнка — max(paidUntil).
  const subs = await payload.find({
    collection: 'subscriptions',
    sort: '-paidUntil',
    limit: 5000,
    depth: 0,
    pagination: false,
    user,
    overrideAccess: false,
  })
  const latestByPlayer = new Map<number, (typeof subs.docs)[number]>()
  for (const s of subs.docs) {
    const pid = relId(s.player)
    if (pid != null && !latestByPlayer.has(pid)) latestByPlayer.set(pid, s)
  }

  const now = new Date()
  const rows = players.docs.map((p) => {
    const sub = latestByPlayer.get(p.id)
    const status = subscriptionStatus(sub?.paidUntil, now)
    return { player: p, sub, status }
  })

  return (
    <AppShell title="Оплата" tabs={COACH_TABS} active="payments">
      {branches && <BranchSwitcher branches={branches} current={ctx} />}
      {canWrite &&
        (players.docs.length ? (
          <PaymentForm players={players.docs.map((p) => ({ id: p.id, name: p.name }))} />
        ) : (
          <p className="muted">Детей в скоупе нет — записывать оплату некому.</p>
        ))}

      <h2 className="section-title">Абонементы</h2>
      {rows.length === 0 ? (
        <p className="muted">Детей пока нет.</p>
      ) : (
        <div className="stack-sm">
          {rows.map(({ player, sub, status }) => (
            <article key={player.id} className="card stack-sm">
              <div className="row-between" style={{ alignItems: 'baseline' }}>
                <strong>{player.name}</strong>
                <span className={STATUS_VIEW[status].cls}>{STATUS_VIEW[status].label}</span>
              </div>
              <div className="muted small">
                {groupNameById.get(relId(player.group) ?? -1) ?? 'Группа'}
                {' · оплачено по '}
                {fmtDate(sub?.paidUntil)}
                {sub?.amount != null ? ` · ${sub.amount} ₽` : ''}
              </div>
              {sub?.note && <div className="muted small">{sub.note}</div>}
            </article>
          ))}
        </div>
      )}
    </AppShell>
  )
}

export default CoachPaymentsPage
