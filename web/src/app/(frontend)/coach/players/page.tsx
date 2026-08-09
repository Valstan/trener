import config from '@payload-config'
import { headers as nextHeaders } from 'next/headers'
import { redirect } from 'next/navigation'
import { getPayload } from 'payload'

import { hasRole, isPending } from '@/access/roles'
import { relId } from '@/lib/relId'

import { AppShell, staffTabs } from '../../components/AppShell'
import { PlayerGroupList } from './PlayerGroupList'

export const dynamic = 'force-dynamic'

const Page = async () => {
  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers: await nextHeaders() })
  if (!user) redirect('/login')
  if (isPending(user)) redirect('/pending')
  if (!hasRole(user, 'owner', 'admin', 'coach')) redirect('/home')
  const [players, groups] = await Promise.all([
    payload.find({ collection: 'players', sort: 'name', depth: 0, limit: 1000, pagination: false, user, overrideAccess: false }),
    payload.find({ collection: 'groups', sort: 'name', depth: 0, limit: 200, pagination: false, user, overrideAccess: false }),
  ])
  return <AppShell title="Дети и группы" tabs={staffTabs(user)} active="players"><PlayerGroupList players={players.docs.map((p) => ({ id: p.id, name: p.name, groupId: relId(p.group) }))} groups={groups.docs.map((g) => ({ id: g.id, name: g.name }))} /></AppShell>
}

export default Page
