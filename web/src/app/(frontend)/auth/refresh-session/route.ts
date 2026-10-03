import config from '@payload-config'
import { getPayload } from 'payload'
import { NextResponse } from 'next/server'

import { homePathForUser } from '@/lib/auth/home'
import { buildAuthCookie } from '@/lib/auth/session'
import { rateLimit } from '@/lib/rateLimit'

// Продление сессии. Аудит #057 (вектор c): мутирующий GET, достижимый top-level
// навигацией с чужого сайта (SameSite=Lax отправляет cookie на <a href> с чужого
// origin) и без ограничения частоты — каждый вызов создаёт новую запись в
// `user.sessions[]`, а список никогда не чистится, кроме явного выхода. Переносим на
// POST + лимит: на клиентах это единственный вызов ссылки «обновить сессию», который
// можно безопасно сделать формой.
export const dynamic = 'force-dynamic'

export const POST = async (req: Request): Promise<Response> => {
  if (!rateLimit(req, { name: 'auth:refresh-session', limit: 30, windowMs: 15 * 60_000 })) {
    return NextResponse.json({ ok: false }, { status: 429 })
  }
  const payload = await getPayload({ config }); const { user } = await payload.auth({ headers: req.headers })
  if (!user) return NextResponse.redirect(new URL('/login', req.url))
  const fresh = await payload.findByID({ collection: 'users', id: user.id, depth: 0, overrideAccess: true })
  const response = NextResponse.redirect(new URL(homePathForUser(fresh), req.url))
  response.headers.set('Set-Cookie', await buildAuthCookie(payload, fresh))
  return response
}
