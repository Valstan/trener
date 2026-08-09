import config from '@payload-config'
import { headers as nextHeaders } from 'next/headers'
import { redirect } from 'next/navigation'
import { getPayload } from 'payload'
import React from 'react'
import Link from 'next/link'

import { isParent, isPending } from '@/access/roles'
import { feeForGroup, formatFee } from '@/lib/fee'
import { sumAmounts } from '@/lib/paymentTotals'
import { relId } from '@/lib/relId'
import { STATUS_VIEW, subscriptionStatus } from '@/lib/subscriptionStatus'

import { AppShell, PARENT_TABS } from '../../components/AppShell'
import { CopyDetails } from './CopyDetails'

// Раздел «Оплата» родителя (M8): абонементы своих детей (когда заканчивается,
// сколько) + помощник оплаты — реквизиты филиала, копирование в буфер, ссылка
// на форму оплаты. Деньги через приложение не ходят.
export const dynamic = 'force-dynamic'

const fmtDate = (iso: string | null | undefined): string => {
  if (!iso) return '—'
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })
}

const ParentPaymentsPage = async () => {
  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers: await nextHeaders() })
  if (!user) redirect('/login')
  if (isPending(user)) redirect('/pending')
  if (!isParent(user)) redirect('/')

  // Свои дети (scoped read).
  const players = await payload.find({
    collection: 'players',
    sort: 'name',
    limit: 100,
    depth: 0,
    pagination: false,
    user,
    overrideAccess: false,
  })

  // Абонементы своих детей (scoped read): актуальная запись = max(paidUntil).
  const subs = await payload.find({
    collection: 'subscriptions',
    sort: '-paidUntil',
    limit: 500,
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

  // Группы детей и их филиалы: из них берём цену абонемента (группа важнее филиала)
  // и реквизиты оплаты. Служебные find — overrideAccess (G90).
  const groupIds = [...new Set(players.docs.map((p) => relId(p.group)).filter((v): v is number => v != null))]
  const groups = groupIds.length
    ? (
        await payload.find({
          collection: 'groups',
          where: { id: { in: groupIds } },
          depth: 0,
          pagination: false,
          overrideAccess: true,
        })
      ).docs
    : []
  const groupById = new Map(groups.map((g) => [g.id, g]))
  const branchIds = [...new Set(groups.map((g) => relId(g.branch)).filter((v): v is number => v != null))]
  const branches = branchIds.length
    ? (
        await payload.find({
          collection: 'branches',
          where: { id: { in: branchIds } },
          depth: 0,
          pagination: false,
          overrideAccess: true,
        })
      ).docs
    : []
  const branchById = new Map(branches.map((b) => [b.id, b]))

  const feeForPlayer = (groupId: number | null): number | null => {
    const group = groupId != null ? groupById.get(groupId) : undefined
    const branch = group ? branchById.get(relId(group.branch) ?? -1) : undefined
    return feeForGroup(group?.monthlyFee, branch?.monthlyFee)
  }

  // Реквизиты — филиала первого ребёнка. Дети одного родителя в РАЗНЫХ филиалах
  // (сеть межгородская) — редкий, но возможный случай: тогда ниже показываем
  // реквизиты каждого филиала, а не только первого.
  const paymentBranches = branches.filter((b) => b.paymentDetails || b.paymentUrl)

  const now = new Date()

  return (
    <AppShell title="Оплата" tabs={PARENT_TABS} active="payments">
      {/* Кнопка — только при наличии детей: без них маршрут всё равно отвечает 403
          («не в какой филиал писать»), а кнопка обещала обратное. */}
      {players.docs.length > 0 && (
        <Link className="btn btn-primary btn-block" href="/parent/payment-chat">Написать в бухгалтерию →</Link>
      )}
      {players.docs.length === 0 ? (
        <div className="empty-state">
          <span className="ic" aria-hidden>
            💳
          </span>
          Пока к вам не привязан ни один ребёнок.
        </div>
      ) : (
        <div className="stack-sm">
          {players.docs.map((p) => {
            const sub = latestByPlayer.get(p.id)
            const status = subscriptionStatus(sub?.paidUntil, now)
            const fee = feeForPlayer(relId(p.group))
            // «К оплате» показываем, когда платить пора: срок кончается, уже вышел
            // или записи нет вовсе. У оплаченного абонемента вопроса «сколько» нет.
            const showDue = fee != null && status !== 'active'
            return (
              <article key={p.id} className="card stack-sm">
                <div className="row-between" style={{ alignItems: 'baseline' }}>
                  <strong>{p.name}</strong>
                  <span className={STATUS_VIEW[status].cls}>{STATUS_VIEW[status].label}</span>
                </div>
                {showDue && (
                  <div className="row-between" style={{ alignItems: 'baseline' }}>
                    <span>
                      К оплате: <strong>{formatFee(fee)}</strong>
                    </span>
                    <span className="muted small">за месяц</span>
                  </div>
                )}
                <div className="muted small">
                  {status === 'none'
                    ? 'Оплата пока не отмечена'
                    : `Оплачено по ${fmtDate(sub?.paidUntil)}`}
                  {sub?.amount != null ? ` · прошлый платёж ${formatFee(sub.amount)}` : ''}
                </div>
              </article>
            )
          })}
        </div>
      )}

      {subs.docs.length > 0 && (
        <>
          <h2 className="section-title">История платежей</h2>
          <div className="stack-sm">
            {subs.docs.map((s) => {
              const name = players.docs.find((p) => p.id === relId(s.player))?.name ?? 'ребёнок'
              return (
                <article key={s.id} className="card stack-sm">
                  <div className="row-between" style={{ alignItems: 'baseline' }}>
                    <strong>{name}</strong>
                    <span>{s.amount != null ? formatFee(s.amount) : '—'}</span>
                  </div>
                  <span className="muted small">
                    Оплачено {s.paidFrom ? `с ${fmtDate(s.paidFrom)} ` : ''}по {fmtDate(s.paidUntil)}
                    {s.note ? ` · ${s.note}` : ''}
                  </span>
                </article>
              )
            })}
          </div>
          <p className="muted small" style={{ marginTop: '0.5rem' }}>
            Всего отмечено: <strong>{formatFee(sumAmounts(subs.docs))}</strong>. Если чего-то не хватает —
            напишите в бухгалтерию, отметки ставит школа вручную.
          </p>
        </>
      )}

      <h2 className="section-title">Как оплатить</h2>
      {paymentBranches.length ? (
        <div className="stack-sm">
          {paymentBranches.map((b) => (
            <div key={b.id} className="card stack-sm">
              {paymentBranches.length > 1 && <strong>{b.name}</strong>}
              {b.paymentDetails && (
                <p className="pre" style={{ margin: 0 }}>
                  {b.paymentDetails}
                </p>
              )}
              <div className="row" style={{ gap: '0.5rem', flexWrap: 'wrap' }}>
                {b.paymentDetails && <CopyDetails text={b.paymentDetails} />}
                {b.paymentUrl && (
                  <a className="btn btn-primary" href={b.paymentUrl} target="_blank" rel="noopener noreferrer">
                    Перейти к оплате →
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="muted">
          Реквизиты оплаты появятся здесь, когда их заполнит администрация школы. Пока —
          уточните у тренера.
        </p>
      )}
    </AppShell>
  )
}

export default ParentPaymentsPage
