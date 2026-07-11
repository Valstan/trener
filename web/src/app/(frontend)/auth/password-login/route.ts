import config from '@payload-config'
import { getPayload } from 'payload'
import { NextResponse } from 'next/server'
import { generatePayloadCookie } from 'payload/shared'

import type { User } from '@/payload-types'
import { homePathForUser } from '@/lib/auth/home'

// POST { email, password } → вход по паролю (аддитивно к magic-link/SSO). Проверку
// пароля делает payload.login (локальная стратегия, bcrypt); при успехе ставим ту же
// сессию-cookie 'payload-token', что и magic-link.
//
// Анти-enumeration: неверный email, неверный пароль и аккаунт без пароля дают ОДИН
// generic-ответ 401 `invalid` — по ответу нельзя отличить «нет такого email» от
// «пароль не тот». (В отличие от magic-link здесь скрыть факт неудачи нельзя, но факт
// существования email — скрываем.)
export const dynamic = 'force-dynamic'

export const POST = async (req: Request): Promise<Response> => {
  let email = ''
  let password = ''
  try {
    const body = (await req.json()) as { email?: unknown; password?: unknown }
    if (typeof body?.email === 'string') email = body.email.trim().toLowerCase()
    if (typeof body?.password === 'string') password = body.password
  } catch {
    // ниже 400
  }

  if (!email.includes('@') || !password) {
    return NextResponse.json({ ok: false }, { status: 400 })
  }

  try {
    const payload = await getPayload({ config })

    let result: Awaited<ReturnType<typeof payload.login>>
    try {
      result = await payload.login({ collection: 'users', data: { email, password } })
    } catch {
      // Неверные учётные данные ИЛИ у аккаунта не задан пароль (вход только по ссылке).
      return NextResponse.json({ ok: false, reason: 'invalid' }, { status: 401 })
    }

    const { token } = result
    const user = result.user as User
    if (!user || !token) return NextResponse.json({ ok: false, reason: 'invalid' }, { status: 401 })

    const collection = payload.collections['users']?.config
    if (!collection?.auth) return NextResponse.json({ ok: false }, { status: 500 })

    const cookie = generatePayloadCookie({
      collectionAuthConfig: collection.auth,
      cookiePrefix: payload.config.cookiePrefix,
      token,
    })
    const res = NextResponse.json({ ok: true, redirect: homePathForUser(user) })
    res.headers.set('Set-Cookie', cookie)
    return res
  } catch (err) {
    console.error('[auth/password-login]', err)
    return NextResponse.json({ ok: false }, { status: 500 })
  }
}
