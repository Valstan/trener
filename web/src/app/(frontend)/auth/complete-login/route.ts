import config from '@payload-config'
import { getPayload } from 'payload'
import { NextResponse } from 'next/server'

import { acceptInvite } from '@/lib/auth/invite'
import { consumeLoginToken } from '@/lib/auth/magicLink'
import { buildAuthCookie } from '@/lib/auth/session'

// POST { token } → консьюмит одноразовый токен (single-use), выписывает Payload-сессию
// и ставит cookie 'payload-token'. Отдельный POST-шаг (а не консьюм на GET /auth/verify)
// защищает от email-префетчеров/антивирусов, которые GET'ом «прожгли» бы ссылку до клика.
//
// Два сценария по типу токена:
//   • login  — вход существующего пользователя.
//   • invite — онбординг родителя: создаём/находим аккаунт по доказанному email +
//              привязываем ребёнка (acceptInvite), затем ведём на экран согласия.
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

    let userId: number | string
    let redirect = '/'

    if (result.kind === 'invite') {
      const accepted = await acceptInvite(payload, result.email, result.playerId)
      if (!accepted.ok) {
        // Ребёнок уже привязан к другому аккаунту — явная 409 (анти-перехват).
        const status = accepted.reason === 'claimed' ? 409 : 401
        return NextResponse.json({ ok: false, reason: accepted.reason }, { status })
      }
      userId = accepted.userId
      redirect = '/onboarding/consent'
    } else {
      userId = result.userId
    }

    const user = await payload.findByID({
      collection: 'users',
      id: userId,
      depth: 0,
      overrideAccess: true,
    })
    if (!user) return NextResponse.json({ ok: false }, { status: 401 })

    const cookie = await buildAuthCookie(payload, user)
    const res = NextResponse.json({ ok: true, redirect })
    res.headers.set('Set-Cookie', cookie)
    return res
  } catch (err) {
    console.error('[auth/complete-login]', err)
    return NextResponse.json({ ok: false }, { status: 500 })
  }
}
