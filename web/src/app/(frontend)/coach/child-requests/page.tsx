import config from '@payload-config'
import { headers as nextHeaders } from 'next/headers'
import { redirect } from 'next/navigation'
import { getPayload } from 'payload'

import { isOwner } from '@/access/roles'
import { relId } from '@/lib/relId'
import { AppShell, COACH_TABS } from '../../components/AppShell'
import { AssignParentForm } from './AssignParentForm'

export const dynamic = 'force-dynamic'
const Page = async () => {
  const payload = await getPayload({ config }); const { user } = await payload.auth({ headers: await nextHeaders() })
  if (!user || !isOwner(user)) redirect('/')
  const [requests, parents, branches] = await Promise.all([
    payload.find({ collection: 'child-registrations', where: { status: { equals: 'owner_review' } }, sort: 'createdAt', limit: 200, pagination: false, depth: 0, overrideAccess: true }),
    payload.find({ collection: 'users', where: { and: [{ roles: { in: ['parent'] } }, { status: { equals: 'approved' } }] }, sort: 'name', limit: 1000, pagination: false, depth: 0, overrideAccess: true }),
    payload.find({ collection: 'branches', limit: 200, pagination: false, depth: 0, overrideAccess: true }),
  ])
  const branchNames = new Map(branches.docs.map((branch) => [branch.id, branch.name]))
  const parentOptions = parents.docs.flatMap((parent) => {
    const branchId = relId(parent.branch)
    if (!branchId) return []
    return [{ id: parent.id, name: parent.name || parent.email, branch: branchNames.get(branchId) ?? `Филиал #${branchId}` }]
  })
  return <AppShell title="Заявки детей" tabs={COACH_TABS} back={{ href: '/admin' }}><div className="stack-sm">{requests.docs.length === 0 && <p className="muted">Новых заявок нет.</p>}{requests.docs.map((request) => <article className="card stack-sm" key={request.id}><strong>{request.childName}</strong><span className="muted small">Дата рождения: {new Date(request.dateOfBirth).toLocaleDateString('ru-RU')}</span><span>Указанный родитель: {request.parentName}</span><AssignParentForm requestId={request.id} parents={parentOptions} /></article>)}</div></AppShell>
}
export default Page
