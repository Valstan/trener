import config from '@payload-config'
import { headers as nextHeaders } from 'next/headers'
import Link from 'next/link'
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
  // Тренировки — предстоящие (иначе 30 самых старых забивали список, и ребёнок
  // переставал видеть ближайшую, как только накапливалась история).
  const since = new Date(Date.now() - 2 * 3600_000).toISOString()
  const [groups, sessions, matches, announcements] = await Promise.all([
    payload.find({ collection: 'groups', where: { id: { in: groupIds } }, depth: 0, overrideAccess: true }),
    payload.find({ collection: 'training-sessions', where: { and: [{ group: { in: groupIds } }, { startDate: { greater_than: since } }] }, sort: 'startDate', limit: 30, depth: 0, overrideAccess: true }),
    payload.find({ collection: 'matches', where: { group: { in: groupIds } }, sort: '-matchDate', limit: 20, depth: 0, overrideAccess: true }),
    payload.find({ collection: 'announcements', where: { or: [{ group: { in: groupIds } }, { scope: { equals: 'network' } }] }, sort: '-createdAt', limit: 20, depth: 0, overrideAccess: true }),
  ])
  const groupNames = new Map(groups.docs.map((group) => [group.id, group.name]))
  return <AppShell title={groups.docs[0]?.name ?? 'Моя команда'} tabs={CHILD_TABS} active="home">
    <h2 className="section-title">Тренировки</h2>
    {sessions.docs.length === 0
      ? <p className="muted">Ближайших тренировок пока нет.</p>
      : <div className="stack-sm">{sessions.docs.map((session) => <div className="card" key={session.id}><strong>{date(session.startDate)}</strong><div className="muted small">{session.status === 'cancelled' ? 'Отменена' : session.location ?? 'Место уточняется'}</div></div>)}</div>}
    <h2 className="section-title">Матчи</h2>
    {matches.docs.length === 0
      ? <p className="muted">Матчей пока нет.</p>
      : <div className="stack-sm">{matches.docs.map((match) => <Link className="card" href={`/match/${match.id}`} key={match.id}><strong>{match.opponent}</strong><div className="muted small">{groupNames.get(relId(match.group) ?? -1)} · {date(match.matchDate)}</div><span className="small">Открыть матч и комментарии →</span></Link>)}</div>}
    <h2 className="section-title">Объявления</h2>
    {announcements.docs.length === 0
      ? <p className="muted">Объявлений пока нет.</p>
      : <div className="stack-sm">{announcements.docs.map((announcement) => <div className="card" key={announcement.id}><strong>{announcement.title}</strong><p>{announcement.body}</p></div>)}</div>}
  </AppShell>
}

export default ChildPage
