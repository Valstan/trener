import config from '@payload-config'
import { headers as nextHeaders } from 'next/headers'
import { redirect } from 'next/navigation'
import { getPayload } from 'payload'
import React from 'react'
import Link from 'next/link'

import { adminBranchId, isOwner, isPending } from '@/access/roles'
import { feeForGroup, formatFee } from '@/lib/fee'
import { loadOwnerBranch } from '@/lib/ownerBranch'
import { collectedInMonth, debtSummary, monthOf } from '@/lib/paymentTotals'
import { relId } from '@/lib/relId'
import { STATUS_VIEW, subscriptionStatus } from '@/lib/subscriptionStatus'

import { AppShell, staffTabs } from '../../components/AppShell'
import { BranchSwitcher } from '../../components/BranchSwitcher'
import { PaymentForm } from './PaymentForm'

// Раздел «Оплата» персонала (M8): таблица абонементов по детям (актуальная запись
// = максимальный paidUntil) + форма записи оплаты. Запись — владелец и админ
// филиала. Тренер оплату не видит. Деньги через приложение не ходят.
export const dynamic = 'force-dynamic'

const fmtDate = (iso: string | null | undefined): string => {
  if (!iso) return '—'
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })
}

const CoachPaymentsPage = async ({ searchParams }: { searchParams: Promise<{ month?: string; filter?: string }> }) => {
  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers: await nextHeaders() })
  if (!user) redirect('/login')
  if (isPending(user)) redirect('/pending')
  const canWrite = isOwner(user) || adminBranchId(user) != null
  if (!canWrite) redirect('/')

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
  const groupById = new Map(groups.docs.map((g) => [g.id, g]))

  // Цены филиалов — для наследования «группа не задала → берём филиал».
  // Служебный find (G90): филиалы читаем с overrideAccess.
  const branchIds = [...new Set(groups.docs.map((g) => relId(g.branch)).filter((v): v is number => v != null))]
  const branchFeeById = new Map(
    branchIds.length
      ? (
          await payload.find({
            collection: 'branches',
            where: { id: { in: branchIds } },
            depth: 0,
            pagination: false,
            overrideAccess: true,
          })
        ).docs.map((b) => [b.id, b.monthlyFee ?? null])
      : [],
  )
  const feeForPlayerGroup = (groupId: number | null): number | null => {
    const group = groupId != null ? groupById.get(groupId) : undefined
    return feeForGroup(group?.monthlyFee, branchFeeById.get(relId(group?.branch) ?? -1))
  }
  // Дети в скоупе. Контекст филиала владельца включает и БЕЗГРУППОВЫХ детей
  // филиала (раньше выбранный контекст молча прятал их с экрана оплат).
  const players = await payload.find({
    collection: 'players',
    sort: 'name',
    limit: 1000,
    depth: 0,
    pagination: false,
    where: ctxGroupIds
      ? { or: [{ group: { in: ctxGroupIds } }, { and: [{ group: { exists: false } }, { branch: { equals: ctx } }] }] }
      : {},
    user,
    overrideAccess: false,
  })

  // Абонементы ТОЛЬКО детей экрана (раньше выборка шла без where — на сети из
  // нескольких школ это полная таблица на каждый рендер).
  const playerIds = players.docs.map((p) => p.id)
  const subs = playerIds.length
    ? await payload.find({
        collection: 'subscriptions',
        where: { player: { in: playerIds } },
        sort: '-paidUntil',
        limit: 5000,
        depth: 0,
        pagination: false,
        user,
        overrideAccess: false,
      })
    : { docs: [] as never[] }
  const latestByPlayer = new Map<number, (typeof subs.docs)[number]>()
  for (const s of subs.docs) {
    const pid = relId(s.player)
    if (pid != null && !latestByPlayer.has(pid)) latestByPlayer.set(pid, s)
  }

  const now = new Date()
  const allRows = players.docs.map((p) => {
    const sub = latestByPlayer.get(p.id)
    const status = subscriptionStatus(sub?.paidUntil, now)
    return { player: p, sub, status, fee: feeForPlayerGroup(relId(p.group)) }
  })

  // Сводка: собрано за выбранный месяц (по дате записи — деньги через приложение
  // не ходят, отметку ставят в день оплаты) и задолженность по текущим статусам.
  const { month: monthParam, filter } = await searchParams
  const month = /^\d{4}-\d{2}$/.test(monthParam ?? '') ? monthParam! : (monthOf(now.toISOString()) ?? '')
  const collected = collectedInMonth(subs.docs, month)
  const debt = debtSummary(allRows)
  const monthLabel = new Date(`${month}-01T00:00:00`).toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' })
  const shiftMonth = (delta: number): string => {
    const [y, m] = month.split('-').map(Number)
    const d = new Date(y, (m ?? 1) - 1 + delta, 1)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  }
  const onlyDebt = filter === 'debt'
  const rows = onlyDebt ? allRows.filter((r) => r.status === 'expired' || r.status === 'none') : allRows

  return (
    <AppShell title="Оплата" tabs={staffTabs(user)} active="payments">
      <Link className="btn btn-primary btn-block" href="/coach/payment-chats">Чаты родителей по оплате →</Link>
      {branches && <BranchSwitcher branches={branches} current={ctx} />}

      <div className="card stack-sm">
        <div className="row-between" style={{ alignItems: 'baseline' }}>
          <Link className="small" href={`/coach/payments?month=${shiftMonth(-1)}${onlyDebt ? '&filter=debt' : ''}`}>‹ пред.</Link>
          <strong>{monthLabel}</strong>
          <Link className="small" href={`/coach/payments?month=${shiftMonth(1)}${onlyDebt ? '&filter=debt' : ''}`}>след. ›</Link>
        </div>
        <div className="big-stat">Собрано: {formatFee(collected.total)}</div>
        <span className="muted small">{collected.count} записей об оплате за месяц</span>
        <div className="row-between" style={{ alignItems: 'baseline' }}>
          <span>
            Задолженность: <strong>{formatFee(debt.total)}</strong>{' '}
            <span className="muted small">({debt.count} детей)</span>
          </span>
          <Link className="small" href={onlyDebt ? '/coach/payments' : '/coach/payments?filter=debt'}>
            {onlyDebt ? 'показать всех' : 'только должники →'}
          </Link>
        </div>
      </div>
      {canWrite &&
        (players.docs.length ? (
          <PaymentForm
            players={players.docs.map((p) => ({
              id: p.id,
              name: p.name,
              fee: feeForPlayerGroup(relId(p.group)),
            }))}
          />
        ) : (
          <p className="muted">В этом филиале ещё нет детей — записывать оплату некому.</p>
        ))}

      <h2 className="section-title">{onlyDebt ? 'Должники' : 'Абонементы'}</h2>
      {rows.length === 0 ? (
        <p className="muted">{onlyDebt ? 'Должников нет — все оплатили.' : 'Детей пока нет.'}</p>
      ) : (
        <div className="stack-sm">
          {rows.map(({ player, sub, status, fee }) => (
            <Link key={player.id} href={`/coach/payments/player/${player.id}`} className="card stack-sm">
              <div className="row-between" style={{ alignItems: 'baseline' }}>
                <strong>{player.name}</strong>
                <span className={STATUS_VIEW[status].cls}>{STATUS_VIEW[status].label}</span>
              </div>
              <div className="muted small">
                {groupNameById.get(relId(player.group) ?? -1) ?? 'Без группы'}
                {status === 'none' ? ' · оплата не отмечена' : ` · оплачено по ${fmtDate(sub?.paidUntil)}`}
                {fee != null ? ` · абонемент ${formatFee(fee)}` : ''}
              </div>
              {sub?.note && <div className="muted small">{sub.note}</div>}
              <span className="small">История платежей →</span>
            </Link>
          ))}
        </div>
      )}
    </AppShell>
  )
}

export default CoachPaymentsPage
