import config from '@payload-config'
import { headers as nextHeaders } from 'next/headers'
import { redirect } from 'next/navigation'
import { getPayload } from 'payload'

import { isPending } from '@/access/roles'
import { ChildRegistrationForm } from './ChildRegistrationForm'

export const dynamic = 'force-dynamic'
const Page = async () => {
  const payload = await getPayload({ config }); const { user } = await payload.auth({ headers: await nextHeaders() })
  if (!user) redirect('/login')
  if (!isPending(user) || user.requestedRole !== 'child') redirect('/pending')
  const existing = await payload.find({ collection: 'child-registrations', where: { account: { equals: user.id } }, limit: 1, overrideAccess: true })
  if (existing.docs.length) redirect('/pending')
  return <main className="page" style={{ maxWidth: 520 }}><h1>Заявка ребёнка</h1><p className="muted">Укажите данные, по которым владелец школы найдёт аккаунт вашего родителя.</p><ChildRegistrationForm initialName={user.name ?? ''} /></main>
}
export default Page
