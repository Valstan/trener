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
    await payload.create({ collection: 'child-registrations', data: { account: user.id, childName, parentName, dateOfBirth, status: 'owner_review' }, overrideAccess: true })
    await payload.update({ collection: 'users', id: user.id, data: { name: childName }, overrideAccess: true })
    return NextResponse.json({ ok: true })
  } catch { return NextResponse.json({ ok: false }, { status: 409 }) }
}
