import config from '@payload-config'
import { headers as nextHeaders } from 'next/headers'
import { notFound, redirect } from 'next/navigation'
import { getPayload } from 'payload'

import { adminBranchId, isOwner, isPending } from '@/access/roles'
import { feeForGroup } from '@/lib/fee'
import { relId } from '@/lib/relId'
import { AppShell, staffTabs } from '../../../components/AppShell'
import { PaymentMessageForm } from '../../../components/PaymentMessageForm'
import { QuickPayment } from './QuickPayment'

export const dynamic = 'force-dynamic'
const fmt = (value?: string | null) => value ? new Date(value).toLocaleDateString('ru-RU') : 'нет оплаты'

const Page = async ({ params }: { params: Promise<{ id: string }> }) => {
  const payload = await getPayload({ config }); const { user } = await payload.auth({ headers: await nextHeaders() })
  if (!user) redirect('/login'); if (isPending(user)) redirect('/pending')
  // Админ филиала — тоже бухгалтерия (scoped read ограничит его нитями филиала).
  if (!isOwner(user) && adminBranchId(user) == null) redirect('/home')
  const id = Number((await params).id)
  const thread = await payload.findByID({ collection: 'payment-threads', id, depth: 1, user, overrideAccess: false }).catch(() => null)
  if (!thread) notFound()
  const [children, messages] = await Promise.all([
    payload.find({ collection: 'players', where: { parent: { equals: relId(thread.parent) } }, depth: 1, limit: 100, overrideAccess: true }),
    payload.find({ collection: 'payment-messages', where: { thread: { equals: id } }, sort: 'createdAt', depth: 0, limit: 5000, user, overrideAccess: false }),
  ])
  const subscriptions = await payload.find({ collection: 'subscriptions', where: { player: { in: children.docs.map((child) => child.id) } }, sort: '-paidUntil', depth: 0, limit: 1000, overrideAccess: true })
  const latest = new Map<number, (typeof subscriptions.docs)[number]>()
  subscriptions.docs.forEach((subscription) => { const player = relId(subscription.player); if (player != null && !latest.has(player)) latest.set(player, subscription) })
  const parentName = typeof thread.parent === 'object' ? thread.parent.name : 'Родитель'
  const branchObj = thread.branch && typeof thread.branch === 'object' ? thread.branch : null
  const branchName = branchObj?.name ?? 'Филиал'
  // Цена абонемента для быстрой записи оплаты: группа → филиал (тот же lib/fee).
  const quickChildren = children.docs.map((child) => {
    const group = child.group && typeof child.group === 'object' ? child.group : null
    return { id: child.id, name: child.name, fee: feeForGroup(group?.monthlyFee, branchObj?.monthlyFee ?? null) }
  })
  return <AppShell title={parentName ?? 'Родитель'} tabs={staffTabs(user)} active="payments" back={{ href: '/coach/payment-chats' }}>
    <div className="card stack-sm"><strong>{parentName}</strong><span className="muted small">{branchName}</span>{children.docs.map((child) => { const subscription = latest.get(child.id); return <div className="row-between small" key={child.id}><span>{child.name} · {child.group && typeof child.group === 'object' ? child.group.name : 'Группа ещё не назначена'}</span><span>оплачено по {fmt(subscription?.paidUntil)}{subscription?.amount != null ? ` · последний платёж ${subscription.amount} ₽` : ''}</span></div> })}</div>
    <div style={{ marginTop: '0.75rem' }}><QuickPayment players={quickChildren} /></div>
    <div className="stack-sm" style={{ marginTop: '1rem' }}>{messages.docs.map((message) => <div className={message.authorRole === 'staff' ? 'card card-accent' : 'card'} key={message.id}><strong className="small">{message.authorName}</strong><p style={{ whiteSpace: 'pre-wrap' }}>{message.body}</p></div>)}<PaymentMessageForm threadId={id} /></div>
  </AppShell>
}
export default Page
