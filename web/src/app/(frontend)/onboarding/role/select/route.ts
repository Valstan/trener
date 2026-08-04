import config from '@payload-config'
import { getPayload } from 'payload'
import { NextResponse } from 'next/server'

import { isPending } from '@/access/roles'
import { buildAuthCookie } from '@/lib/auth/session'

export const POST = async (req: Request): Promise<Response> => {
  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers: req.headers })
  if (!user || !isPending(user) || user.requestedRole) return NextResponse.json({ ok: false }, { status: 403 })
  const body = await req.json().catch(() => null) as { role?: unknown } | null
  if (body?.role !== 'child' && body?.role !== 'parent' && body?.role !== 'coach') return NextResponse.json({ ok: false }, { status: 400 })
  const updated = await payload.update({ collection: 'users', id: user.id, data: { requestedRole: body.role, roles: ['applicant'] }, overrideAccess: true })
  const response = NextResponse.json({ ok: true })
  response.headers.set('Set-Cookie', await buildAuthCookie(payload, updated))
  return response
}
