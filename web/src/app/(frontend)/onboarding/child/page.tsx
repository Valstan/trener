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
  // Отклонённая заявка НЕ запирает форму: данные можно поправить и подать снова
  // (раньше любой существующей записи хватало для вечного /pending).
  const rejected = existing.docs[0]?.status === 'rejected'
  if (existing.docs.length && !rejected) redirect('/pending')
  return <main className="page" style={{ maxWidth: 520 }}><h1>Заявка ребёнка</h1>{rejected && <p className="card card-muted" style={{ padding: '0.75rem' }}>Прошлую заявку отклонили. Проверьте данные — особенно имя родителя — и отправьте снова.</p>}<p className="muted">Укажите данные, по которым владелец школы найдёт аккаунт вашего родителя.</p><ChildRegistrationForm initialName={user.name ?? ''} /></main>
}
export default Page
