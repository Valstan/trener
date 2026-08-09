import config from '@payload-config'
import { headers as nextHeaders } from 'next/headers'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { getPayload } from 'payload'
import React from 'react'

import { adminBranchId, isOwner, isPending } from '@/access/roles'
import { feeForGroup, formatFee } from '@/lib/fee'
import { sumAmounts } from '@/lib/paymentTotals'
import { relId } from '@/lib/relId'
import { STATUS_VIEW, subscriptionStatus } from '@/lib/subscriptionStatus'

import { AppShell, staffTabs } from '../../../../components/AppShell'

// История платежей одного ребёнка (M8 доводка 09.08). Журнальная модель в БД была
// с самого начала, но журнального ПРЕДСТАВЛЕНИЯ не существовало: и бухгалтер, и
// родитель видели ровно одну (последнюю) запись — «сколько заплачено за сезон» и
// «кто отметил вон ту оплату» ответа не имели.
export const dynamic = 'force-dynamic'

const fmtDate = (iso: string | null | undefined): string => {
  if (!iso) return '—'
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })
}

const PlayerPaymentsPage = async ({ params }: { params: Promise<{ id: string }> }) => {
  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers: await nextHeaders() })
  if (!user) redirect('/login')
  if (isPending(user)) redirect('/pending')
  if (!isOwner(user) && adminBranchId(user) == null) redirect('/')

  const playerId = Number((await params).id)
  if (!Number.isInteger(playerId) || playerId <= 0) notFound()

  // Ребёнок — ПОД ролью (scoped read сам ограничит филиалом админа).
  const player = await payload
    .findByID({ collection: 'players', id: playerId, depth: 0, user, overrideAccess: false })
    .catch(() => null)
  if (!player) notFound()

  const groupId = relId(player.group)
  const group = groupId != null
    ? await payload.findByID({ collection: 'groups', id: groupId, depth: 0, overrideAccess: true }).catch(() => null)
    : null
  const branchId = relId(group?.branch) ?? relId(player.branch)
  const branch = branchId != null
    ? await payload.findByID({ collection: 'branches', id: branchId, depth: 0, overrideAccess: true }).catch(() => null)
    : null
  const fee = feeForGroup(group?.monthlyFee, branch?.monthlyFee ?? null)

  const subs = await payload.find({
    collection: 'subscriptions',
    where: { player: { equals: playerId } },
    sort: '-paidUntil',
    limit: 500,
    depth: 0,
    pagination: false,
    user,
    overrideAccess: false,
  })

  // Имена «кто записал» — служебное чтение (G90).
  const recorderIds = [...new Set(subs.docs.map((s) => relId(s.recordedBy)).filter((v): v is number => v != null))]
  const recorders = recorderIds.length
    ? await payload.find({ collection: 'users', where: { id: { in: recorderIds } }, depth: 0, limit: 100, pagination: false, overrideAccess: true })
    : { docs: [] }
  const recorderName = new Map(recorders.docs.map((u) => [u.id, u.name || u.email]))

  const total = sumAmounts(subs.docs)
  const status = subscriptionStatus(subs.docs[0]?.paidUntil, new Date())

  return (
    <AppShell title={player.name} tabs={staffTabs(user)} active="payments" back={{ href: '/coach/payments' }}>
      <div className="card stack-sm">
        <div className="row-between" style={{ alignItems: 'baseline' }}>
          <strong>{player.name}</strong>
          <span className={STATUS_VIEW[status].cls}>{STATUS_VIEW[status].label}</span>
        </div>
        <span className="muted small">
          {group?.name ?? 'Без группы'}
          {branch ? ` · ${branch.name}` : ''}
          {fee != null ? ` · абонемент ${formatFee(fee)}` : ''}
        </span>
        <div className="big-stat">Всего оплачено: {formatFee(total)}</div>
        <span className="muted small">{subs.docs.length} записей за всё время</span>
      </div>

      <h2 className="section-title">История платежей</h2>
      {subs.docs.length === 0 ? (
        <p className="muted">Оплаты пока не отмечались.</p>
      ) : (
        <div className="stack-sm">
          {subs.docs.map((s) => (
            <article key={s.id} className="card stack-sm">
              <div className="row-between" style={{ alignItems: 'baseline' }}>
                <strong>{s.amount != null ? formatFee(s.amount) : 'сумма не указана'}</strong>
                <span className="muted small">записано {fmtDate(s.createdAt)}</span>
              </div>
              <span className="muted small">
                Период: {s.paidFrom ? `${fmtDate(s.paidFrom)} — ` : 'по '}
                {fmtDate(s.paidUntil)}
              </span>
              <span className="muted small">
                Отметил: {recorderName.get(relId(s.recordedBy) ?? -1) ?? 'неизвестно (запись до аудита)'}
              </span>
              {s.note && <span className="small">{s.note}</span>}
            </article>
          ))}
        </div>
      )}

      <p className="note" style={{ marginTop: '1rem' }}>
        <Link href="/coach/payments">← Ко всем абонементам</Link>
      </p>
    </AppShell>
  )
}

export default PlayerPaymentsPage
