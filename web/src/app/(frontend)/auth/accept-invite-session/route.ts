import config from '@payload-config'
import { NextResponse } from 'next/server'
import { getPayload } from 'payload'

import { linkPlayerToUser, peekInviteToken } from '@/lib/auth/invite'
import { isParent } from '@/access/roles'

// POST { token (join) } — приём приглашения УЖЕ ЗАЛОГИНЕННЫМ родителем (вошёл через
// VK или magic-link): личность доказана живой сессией, email-раунд не нужен —
// привязываем ребёнка к аккаунту сессии one-click'ом. Без сессии этот маршрут не
// работает (401) — аноним идёт классическим путём через email-подтверждение.
//
// Привязка — только на роль parent: персонал (coach/admin), открывший join-ссылку
// под своим аккаунтом, не должен случайно записать ребёнка на себя.
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
    const { user } = await payload.auth({ headers: req.headers })
    if (!user) return NextResponse.json({ ok: false }, { status: 401 })
    if (!isParent(user)) return NextResponse.json({ ok: false, reason: 'not-parent' }, { status: 403 })

    const preview = await peekInviteToken(payload, token)
    if (!preview.ok) return NextResponse.json({ ok: false }, { status: 401 })

    const linked = await linkPlayerToUser(payload, user.id, preview.playerId)
    if (!linked.ok) {
      const status = linked.reason === 'claimed' ? 409 : 401
      return NextResponse.json({ ok: false, reason: linked.reason }, { status })
    }

    // Дальше — экран согласия (152-ФЗ): привязка нового ребёнка = повод подтвердить
    // согласие на обработку его данных, как и в email-ветке complete-login.
    return NextResponse.json({ ok: true, redirect: '/onboarding/consent' })
  } catch (err) {
    console.error('[auth/accept-invite-session]', err)
    return NextResponse.json({ ok: false }, { status: 500 })
  }
}
