import config from '@payload-config'
import { headers as nextHeaders } from 'next/headers'
import { redirect } from 'next/navigation'
import { getPayload } from 'payload'

import { isPending } from '@/access/roles'
import { RoleForm } from './RoleForm'

export const dynamic = 'force-dynamic'

const Page = async () => {
  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers: await nextHeaders() })
  if (!user) redirect('/login')
  if (!isPending(user)) redirect('/')
  if (user.requestedRole) redirect(user.requestedRole === 'child' ? '/onboarding/child' : '/pending')
  return <main className="page" style={{ maxWidth: 520 }}><h1>Кто вы?</h1><p className="muted">Выберите свой статус. Доступы откроются только после проверки.</p><RoleForm /></main>
}
export default Page
