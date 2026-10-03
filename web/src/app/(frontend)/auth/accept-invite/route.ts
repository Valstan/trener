import config from '@payload-config'
import { getPayload } from 'payload'
import { NextResponse } from 'next/server'

import { createInviteAcceptToken, peekInviteToken } from '@/lib/auth/invite'
import { sendInviteAcceptEmail } from '@/lib/email/magicLinkEmail'
import { rateLimit } from '@/lib/rateLimit'

// POST { token (join), email } → если join-токен валиден, шлём родителю письмо со
// ссылкой подтверждения. Ответ всегда нейтрально-одинаков (как у request-login):
// существование/валидность не раскрываем. Привязки ребёнка тут НЕ происходит —
// только после клика по письму (доказанное владение email), см. complete-login.
export const dynamic = 'force-dynamic'

export const POST = async (req: Request): Promise<Response> => {
  // Аудит #057 (вектор a): по утёкшей join-ссылке можно было слать письма
  // подтверждения на произвольные адреса от домена школы (анти-фишинг/abuse).
  if (!rateLimit(req, { name: 'auth:accept-invite', limit: 5, windowMs: 60 * 60_000 })) {
    return NextResponse.json({ ok: true }, { status: 429 })
  }
  let token = ''
  let email = ''
  try {
    const body = (await req.json()) as { token?: unknown; email?: unknown }
    if (typeof body?.token === 'string') token = body.token
    if (typeof body?.email === 'string') email = body.email
  } catch {
    // обработаем как невалидный ввод ниже
  }

  const generic = NextResponse.json({ ok: true })
  if (!token || !email.includes('@')) return generic

  try {
    const payload = await getPayload({ config })
    const preview = await peekInviteToken(payload, token)
    if (!preview.ok) return generic // невалидная ссылка — нейтральный ответ

    const raw = await createInviteAcceptToken(payload, token, email)
    if (raw) await sendInviteAcceptEmail(payload, email.trim().toLowerCase(), raw, preview.playerName)
  } catch (err) {
    console.error('[auth/accept-invite]', err)
  }

  return generic
}
