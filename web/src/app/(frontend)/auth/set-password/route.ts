import config from '@payload-config'
import { getPayload } from 'payload'
import { NextResponse } from 'next/server'

// POST { password } → задать/сменить пароль текущего пользователя. Требует живой сессии
// (личность доказана cookie) — текущий пароль не спрашиваем: сам факт валидной сессии
// достаточен для установки. Пароль хеширует Payload (локальная стратегия, bcrypt).
//
// Позволяет родителю/тренеру, вошедшему по magic-link/SSO, завести постоянный пароль
// и дальше входить им (см. /auth/password-login).
export const dynamic = 'force-dynamic'

const MIN_PASSWORD = 8

export const POST = async (req: Request): Promise<Response> => {
  try {
    const payload = await getPayload({ config })
    const { user } = await payload.auth({ headers: req.headers })
    if (!user) return NextResponse.json({ ok: false }, { status: 401 })

    let password = ''
    try {
      const body = (await req.json()) as { password?: unknown }
      if (typeof body?.password === 'string') password = body.password
    } catch {
      // ниже 400
    }

    if (password.length < MIN_PASSWORD) {
      return NextResponse.json({ ok: false, reason: 'weak' }, { status: 400 })
    }

    // Обновляем ТОЛЬКО свой аккаунт (id из сессии) — overrideAccess с фиксированным id
    // безопасен: чужой аккаунт задеть нельзя. Payload сам захеширует пароль.
    await payload.update({
      collection: 'users',
      id: user.id,
      data: { password },
      overrideAccess: true,
    })

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[auth/set-password]', err)
    return NextResponse.json({ ok: false }, { status: 500 })
  }
}
