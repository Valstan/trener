import config from '@payload-config'
import { headers as nextHeaders } from 'next/headers'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getPayload } from 'payload'

import { isOwner, isPending } from '@/access/roles'

import { AppShell, COACH_TABS } from '../../components/AppShell'

export const dynamic = 'force-dynamic'

const Page = async () => {
  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers: await nextHeaders() })
  if (!user) redirect('/login')
  if (isPending(user)) redirect('/pending')
  if (!isOwner(user)) redirect('/home')
  const threads = await payload.find({ collection: 'payment-threads', sort: '-lastMessageAt', depth: 1, limit: 1000, user, overrideAccess: false })
  return <AppShell title="Чаты по оплате" tabs={COACH_TABS} active="payments" back={{ href: '/coach/payments' }}><div className="stack-sm">{threads.docs.length ? threads.docs.map((thread) => <Link className="card row-between" href={`/coach/payment-chats/${thread.id}`} key={thread.id}><span><strong>{typeof thread.parent === 'object' ? thread.parent.name : 'Родитель'}</strong><span className="muted small" style={{ display: 'block' }}>{thread.branch && typeof thread.branch === 'object' ? thread.branch.name : 'Филиал'}</span></span><span aria-hidden>›</span></Link>) : <p className="muted">Сообщений по оплате пока нет.</p>}</div></AppShell>
}

export default Page
