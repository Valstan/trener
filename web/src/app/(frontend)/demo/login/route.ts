import config from '@payload-config'
import { NextResponse } from 'next/server'
import { getPayload } from 'payload'

import { buildAuthCookie } from '@/lib/auth/session'
import { homePathForUser } from '@/lib/auth/home'
import { parseDemoRole } from '@/lib/demo/demoLogin'
import { DEMO_EMAILS } from '@/lib/demo/constants'

// Вход в витрину D-029: без регистрации и пароля. Механика сессии — та же, что
// magic-link (buildAuthCookie): демо-юзер найден по фиксированному email → кука.
// Демо-owner/admin ведём на staff-фронтенд: /admin им закрыт (Task 4), а
// /coach/* пускает owner/admin как полноправный staff (M5).
export const dynamic = 'force-dynamic'

export const POST = async (req: Request): Promise<Response> => {
  // База для redirect — NEXT_PUBLIC_SERVER_URL, а не req.url: за reverse-proxy
  // req.url — внутренний origin (например localhost:3007), на прод-приёмке
  // D-029 браузер уезжал именно туда. Паттерн — как в auth/vk/callback/route.ts.
  const serverUrl = process.env.NEXT_PUBLIC_SERVER_URL || new URL(req.url).origin

  const formData = await req.formData()
  const role = parseDemoRole(formData.get('role'))
  if (!role) return NextResponse.redirect(new URL('/demo', serverUrl))

  const payload = await getPayload({ config })
  // Гейт demo: { equals: true } в where — обязателен: даже если живой юзер
  // займёт демо-email, сессию ему тут не выпишут.
  const found = await payload.find({
    collection: 'users',
    where: { email: { equals: DEMO_EMAILS[role] }, demo: { equals: true } },
    limit: 1,
    overrideAccess: true,
  })
  const user = found.docs[0]
  if (!user) return NextResponse.redirect(new URL('/demo?state=preparing', serverUrl))

  const cookie = await buildAuthCookie(payload, user)
  const home = role === 'owner' || role === 'admin' ? '/coach/schedule' : homePathForUser(user)
  const res = NextResponse.redirect(new URL(home, serverUrl), 303)
  res.headers.set('Set-Cookie', cookie)
  return res
}
