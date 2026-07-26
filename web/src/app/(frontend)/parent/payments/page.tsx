import config from '@payload-config'
import { headers as nextHeaders } from 'next/headers'
import { redirect } from 'next/navigation'
import { getPayload } from 'payload'
import React from 'react'

import { isParent, isPending } from '@/access/roles'
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

  // Реквизиты филиала: через группу первого ребёнка → branch (у ребёнка один
  // филиал по модели M5). Служебные find — overrideAccess (G90).
  let payment: { details: string | null; url: string | null } = { details: null, url: null }
  const firstGroupId = relId(players.docs[0]?.group)
  if (firstGroupId != null) {
    const group = await payload.findByID({
      collection: 'groups',
      id: firstGroupId,
      depth: 0,
      overrideAccess: true,
    })
    const branchId = relId(group?.branch)
    if (branchId != null) {
      const branch = await payload.findByID({
        collection: 'branches',
        id: branchId,
        depth: 0,
        overrideAccess: true,
      })
      payment = { details: branch?.paymentDetails ?? null, url: branch?.paymentUrl ?? null }
    }
  }

  const now = new Date()

  return (
    <AppShell title="Оплата" tabs={PARENT_TABS} back={{ href: '/home' }}>
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
            return (
              <article key={p.id} className="card stack-sm">
                <div className="row-between" style={{ alignItems: 'baseline' }}>
                  <strong>{p.name}</strong>
                  <span className={STATUS_VIEW[status].cls}>{STATUS_VIEW[status].label}</span>
                </div>
                <div className="muted small">
                  Оплачено по {fmtDate(sub?.paidUntil)}
                  {sub?.amount != null ? ` · ${sub.amount} ₽` : ''}
                </div>
              </article>
            )
          })}
        </div>
      )}

      <h2 className="section-title">Как оплатить</h2>
      {payment.details || payment.url ? (
        <div className="card stack-sm">
          {payment.details && <p className="pre" style={{ margin: 0 }}>{payment.details}</p>}
          <div className="row" style={{ gap: '0.5rem', flexWrap: 'wrap' }}>
            {payment.details && <CopyDetails text={payment.details} />}
            {payment.url && (
              <a className="btn btn-primary" href={payment.url} target="_blank" rel="noopener noreferrer">
                Перейти к оплате →
              </a>
            )}
          </div>
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
