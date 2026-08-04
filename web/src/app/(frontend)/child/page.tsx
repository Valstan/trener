import config from '@payload-config'
import { headers as nextHeaders } from 'next/headers'
import { redirect } from 'next/navigation'
import { getPayload } from 'payload'

import { childGroupIds, isChild, isPending } from '@/access/roles'
import { relId } from '@/lib/relId'

import { AppShell, CHILD_TABS } from '../components/AppShell'

export const dynamic = 'force-dynamic'

const date = (iso: string) => new Date(iso).toLocaleString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })

const ChildPage = async () => {
  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers: await nextHeaders() })
  if (!user) redirect('/login')
  if (isPending(user)) redirect('/pending')
  if (!isChild(user)) redirect('/home')
  const groupIds = await childGroupIds({ payload } as never, user.id)
  if (!groupIds.length) return <AppShell title="Моя команда" tabs={CHILD_TABS} active="home"><p className="muted">Тренер ещё не назначил вам группу.</p></AppShell>
  const [groups, sessions, matches, announcements] = await Promise.all([
    payload.find({ collection: 'groups', where: { id: { in: groupIds } }, depth: 0, overrideAccess: true }),
    payload.find({ collection: 'training-sessions', where: { group: { in: groupIds } }, sort: 'startDate', limit: 30, depth: 0, overrideAccess: true }),
    payload.find({ collection: 'matches', where: { group: { in: groupIds } }, sort: '-matchDate', limit: 20, depth: 0, overrideAccess: true }),
    payload.find({ collection: 'announcements', where: { or: [{ group: { in: groupIds } }, { scope: { equals: 'network' } }] }, sort: '-createdAt', limit: 20, depth: 0, overrideAccess: true }),
  ])
  const groupNames = new Map(groups.docs.map((g) => [g.id, g.name]))
  return <AppShell title={groups.docs[0]?.name ?? 'Моя команда'} tabs={CHILD_TABS} active="home">
    <h2 className="section-title">Тренировки</h2>
    <div className="stack-sm">{sessions.docs.map((s) => <div className="card" key={s.id}><strong>{date(s.startDate)}</strong><div className="muted small">{s.location ?? 'Место уточняется'}</div></div>)}</div>
    <h2 className="section-title">Матчи</h2>
    <div className="stack-sm">{matches.docs.map((m) => <div className="card" key={m.id}><strong>{m.opponent}</strong><div className="muted small">{groupNames.get(relId(m.group) ?? -1)} · {date(m.matchDate)}</div></div>)}</div>
    <h2 className="section-title">Объявления</h2>
    <div className="stack-sm">{announcements.docs.map((a) => <div className="card" key={a.id}><strong>{a.title}</strong><p>{a.body}</p></div>)}</div>
  </AppShell>
}

export default ChildPage
