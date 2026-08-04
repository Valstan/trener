import config from '@payload-config'
import { headers as nextHeaders } from 'next/headers'
import { redirect } from 'next/navigation'
import { getPayload } from 'payload'

import { isParent, isPending } from '@/access/roles'
import { relId } from '@/lib/relId'

import { AppShell, PARENT_TABS } from '../../components/AppShell'
import { PaymentMessageForm } from '../../components/PaymentMessageForm'

export const dynamic = 'force-dynamic'

const ParentPaymentChat = async () => {
  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers: await nextHeaders() })
  if (!user) redirect('/login')
  if (isPending(user)) redirect('/pending')
  if (!isParent(user)) redirect('/home')
  const players = await payload.find({ collection: 'players', where: { parent: { equals: user.id } }, depth: 1, limit: 100, overrideAccess: true })
  const branchIds = [...new Set(players.docs.map((p) => p.group && typeof p.group === 'object' ? relId(p.group.branch) : relId(p.branch)).filter((id): id is number => id != null))]
  const [branches, threads] = await Promise.all([
    payload.find({ collection: 'branches', where: { id: { in: branchIds } }, depth: 0, limit: 100, overrideAccess: true }),
    payload.find({ collection: 'payment-threads', sort: '-lastMessageAt', depth: 0, limit: 100, user, overrideAccess: false }),
  ])
  const threadByBranch = new Map(threads.docs.map((t) => [relId(t.branch), t]))
  return <AppShell title="Связь с бухгалтерией" tabs={PARENT_TABS} active="payments" back={{ href: '/parent/payments' }}><div className="stack-sm">{branches.docs.map(async (branch) => {
    const thread = threadByBranch.get(branch.id)
    const messages = thread ? await payload.find({ collection: 'payment-messages', where: { thread: { equals: thread.id } }, sort: 'createdAt', depth: 0, limit: 1000, user, overrideAccess: false }) : null
    return <details className="card" key={branch.id} open={branches.docs.length === 1}><summary><strong>{branch.name}</strong></summary><div className="stack-sm" style={{ marginTop: '1rem' }}>{messages?.docs.map((message) => <div key={message.id} className={message.authorRole === 'staff' ? 'card card-accent' : 'card'}><strong className="small">{message.authorName}</strong><p style={{ whiteSpace: 'pre-wrap' }}>{message.body}</p></div>)}<PaymentMessageForm threadId={thread?.id} branchId={branch.id} /></div></details>
  })}</div></AppShell>
}

export default ParentPaymentChat
