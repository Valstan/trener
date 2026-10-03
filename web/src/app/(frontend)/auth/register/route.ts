import config from '@payload-config'
import { getPayload } from 'payload'
import { NextResponse } from 'next/server'

import { createLoginToken } from '@/lib/auth/magicLink'
import { generateRawToken } from '@/lib/auth/tokens'
import { sendLoginEmail } from '@/lib/email/magicLinkEmail'
import { rateLimit } from '@/lib/rateLimit'

export const POST = async (req: Request): Promise<Response> => {
  // Аудит #057 (вектор a): саморегистрация без лимита = письма на произвольные адреса
  // + неограниченный рост users/login-tokens. Гейт ДО создания записи и до письма.
  if (!rateLimit(req, { name: 'auth:register', limit: 3, windowMs: 60 * 60_000 })) {
    return NextResponse.json({ ok: true }, { status: 429 })
  }
  const body = await req.json().catch(() => null) as { email?: unknown } | null
  const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : ''
  const generic = NextResponse.json({ ok: true })
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return generic
  try {
    const payload = await getPayload({ config })
    const found = await payload.find({ collection: 'users', where: { email: { equals: email } }, limit: 1, overrideAccess: true })
    if (!found.docs.length) await payload.create({ collection: 'users', data: { email, password: generateRawToken(), roles: ['applicant'], status: 'pending' }, overrideAccess: true })
    const token = await createLoginToken(payload, email)
    if (token) await sendLoginEmail(payload, email, token)
  } catch (error) { console.error('[auth/register]', error) }
  return generic
}
