import config from '@payload-config'
import { getPayload } from 'payload'
import { NextResponse } from 'next/server'

import { isPending } from '@/access/roles'
import { buildAuthCookie } from '@/lib/auth/session'
import { buildRegistrationSubmittedMessage } from '@/lib/push/message'
import { sendPushToUser } from '@/lib/push/send'

export const POST = async (req: Request): Promise<Response> => {
  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers: req.headers })
  if (!user || !isPending(user) || user.requestedRole) return NextResponse.json({ ok: false }, { status: 403 })
  const body = await req.json().catch(() => null) as { role?: unknown } | null
  if (body?.role !== 'child' && body?.role !== 'parent' && body?.role !== 'coach') return NextResponse.json({ ok: false }, { status: 400 })
  const updated = await payload.update({ collection: 'users', id: user.id, data: { requestedRole: body.role, roles: ['applicant'] }, overrideAccess: true })

  // Взрослая заявка готова к рассмотрению прямо сейчас — пуш владельцам (best-effort).
  // Детская пушится позже, из fanOutRegistration при создании child-registration.
  if (body.role !== 'child') {
    try {
      const owners = await payload.find({ collection: 'users', where: { roles: { in: ['owner'] } }, depth: 0, limit: 20, pagination: false, overrideAccess: true })
      const message = buildRegistrationSubmittedMessage()
      for (const owner of owners.docs) await sendPushToUser(payload, owner.id, message).catch(() => {})
    } catch (err) {
      payload.logger.warn({ err }, '[onboarding/role] пуш владельцам не отправлен')
    }
  }

  const response = NextResponse.json({ ok: true })
  response.headers.set('Set-Cookie', await buildAuthCookie(payload, updated))
  return response
}
