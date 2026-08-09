import config from '@payload-config'
import { getPayload } from 'payload'
import { NextResponse } from 'next/server'

import { isPending } from '@/access/roles'

export const POST = async (req: Request): Promise<Response> => {
  const payload = await getPayload({ config }); const { user } = await payload.auth({ headers: req.headers })
  if (!user || !isPending(user) || user.requestedRole !== 'child') return NextResponse.json({ ok: false }, { status: 403 })
  const body = await req.json().catch(() => null) as Record<string, unknown> | null
  const childName = typeof body?.childName === 'string' ? body.childName.trim().slice(0, 120) : ''
  const parentName = typeof body?.parentName === 'string' ? body.parentName.trim().slice(0, 120) : ''
  const dateOfBirth = typeof body?.dateOfBirth === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(body.dateOfBirth) ? body.dateOfBirth : ''
  if (!childName || !parentName || !dateOfBirth) return NextResponse.json({ ok: false }, { status: 400 })
  try {
    // Повторная подача после отклонения: account unique — отклонённую запись
    // обновляем (новые данные, снова owner_review), а не плодим вторую.
    const existing = await payload.find({ collection: 'child-registrations', where: { account: { equals: user.id } }, limit: 1, depth: 0, pagination: false, overrideAccess: true })
    const prev = existing.docs[0]
    if (prev && prev.status !== 'rejected') return NextResponse.json({ ok: false }, { status: 409 })
    if (prev) {
      await payload.update({ collection: 'child-registrations', id: prev.id, data: { childName, parentName, dateOfBirth, status: 'owner_review', proposedParent: null, branch: null }, overrideAccess: true })
    } else {
      await payload.create({ collection: 'child-registrations', data: { account: user.id, childName, parentName, dateOfBirth, status: 'owner_review' }, overrideAccess: true })
    }
    await payload.update({ collection: 'users', id: user.id, data: { name: childName }, overrideAccess: true })
    return NextResponse.json({ ok: true })
  } catch { return NextResponse.json({ ok: false }, { status: 409 }) }
}
