import config from '@payload-config'
import { getPayload } from 'payload'
import { NextResponse } from 'next/server'

import { consumeLoginToken } from '@/lib/auth/magicLink'
import { buildAuthCookie } from '@/lib/auth/session'

// POST { token } → консьюмит одноразовый токен (single-use), выписывает Payload-сессию
// и ставит cookie 'payload-token'. Отдельный POST-шаг (а не консьюм на GET /auth/verify)
// защищает от email-префетчеров/антивирусов, которые GET'ом «прожгли» бы ссылку до клика.
export const dynamic = 'force-dynamic'

export const POST = async (req: Request): Promise<Response> => {
  let token = ''
  try {
    const body = (await req.json()) as { token?: unknown }
    if (typeof body?.token === 'string') token = body.token
  } catch {
    // пустой токен обработаем ниже
  }

  if (!token) return NextResponse.json({ ok: false }, { status: 400 })

  try {
    const payload = await getPayload({ config })
    const result = await consumeLoginToken(payload, token)
    if (!result.ok) return NextResponse.json({ ok: false }, { status: 401 })

    const user = await payload.findByID({
      collection: 'users',
      id: result.userId,
      depth: 0,
      overrideAccess: true,
    })
    if (!user) return NextResponse.json({ ok: false }, { status: 401 })

    const cookie = await buildAuthCookie(payload, user)
    const res = NextResponse.json({ ok: true, redirect: '/' })
    res.headers.set('Set-Cookie', cookie)
    return res
  } catch (err) {
    console.error('[auth/complete-login]', err)
    return NextResponse.json({ ok: false }, { status: 500 })
  }
}
