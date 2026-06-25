import config from '@payload-config'
import { getPayload } from 'payload'
import { NextResponse } from 'next/server'

import { createLoginToken } from '@/lib/auth/magicLink'
import { sendLoginEmail } from '@/lib/email/magicLinkEmail'

// POST { email } → если такой пользователь существует, отправляем письмо со ссылкой
// входа. Ответ ВСЕГДА одинаковый (ok), независимо от существования email — иначе по
// ответу можно перебирать зарегистрированные адреса (enumeration).
export const dynamic = 'force-dynamic'

export const POST = async (req: Request): Promise<Response> => {
  let email = ''
  try {
    const body = (await req.json()) as { email?: unknown }
    if (typeof body?.email === 'string') email = body.email
  } catch {
    // некорректное тело — отдадим тот же generic-ответ ниже
  }

  const generic = NextResponse.json({ ok: true })
  if (!email.includes('@')) return generic

  try {
    const payload = await getPayload({ config })
    const raw = await createLoginToken(payload, email)
    if (raw) await sendLoginEmail(payload, email.trim().toLowerCase(), raw)
  } catch (err) {
    console.error('[auth/request-login]', err)
  }

  return generic
}
