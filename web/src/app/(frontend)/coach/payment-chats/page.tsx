import config from '@payload-config'
import { headers as nextHeaders } from 'next/headers'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getPayload } from 'payload'

import { adminBranchId, isOwner, isPending } from '@/access/roles'

import { AppShell, staffTabs } from '../../components/AppShell'

// Список платёжных диалогов. Доводка 09.08: пускаем и АДМИНА ФИЛИАЛА — он ведёт
// учёт оплат филиала, но был отрезан от переписки с родителями по этой же теме
// (роль «бухгалтер филиала» работала наполовину). Scoped read сам ограничит
// его нитями своего филиала.
export const dynamic = 'force-dynamic'

const Page = async () => {
  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers: await nextHeaders() })
  if (!user) redirect('/login')
  if (isPending(user)) redirect('/pending')
  if (!isOwner(user) && adminBranchId(user) == null) redirect('/home')
  const threads = await payload.find({ collection: 'payment-threads', sort: '-lastMessageAt', depth: 1, limit: 1000, user, overrideAccess: false })
  return <AppShell title="Чаты по оплате" tabs={staffTabs(user)} active="payments" back={{ href: '/coach/payments' }}><div className="stack-sm">{threads.docs.length ? threads.docs.map((thread) => <Link className="card row-between" href={`/coach/payment-chats/${thread.id}`} key={thread.id}><span><strong>{typeof thread.parent === 'object' ? thread.parent.name : 'Родитель'}</strong><span className="muted small" style={{ display: 'block' }}>{thread.branch && typeof thread.branch === 'object' ? thread.branch.name : 'Филиал'}</span></span><span aria-hidden>›</span></Link>) : <p className="muted">Сообщений по оплате пока нет.</p>}</div></AppShell>
}

export default Page
