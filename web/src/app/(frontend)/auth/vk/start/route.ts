import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'

import {
  buildAuthorizeUrl,
  generatePkce,
  getDiscovery,
  getRadarConfig,
  sanitizeNextPath,
  sealTransaction,
} from '@/lib/auth/oidc'
import { generateRawToken } from '@/lib/auth/tokens'

// GET /auth/vk/start — начало входа через VK (Радар-ID): генерим state (CSRF) +
// nonce (replay) + PKCE-verifier, прячем их в короткоживущую httpOnly-cookie и
// редиректим на authorize-эндпоинт Радара. Радар вернёт пользователя на
// /auth/vk/callback с одноразовым кодом.
export const dynamic = 'force-dynamic'

export const GET = async (req: NextRequest): Promise<Response> => {
  const cfg = getRadarConfig()
  const secret = process.env.PAYLOAD_SECRET
  // SSO не сконфигурирован → маршрута «нет» (dev без Радара живёт на magic-link).
  if (!cfg || !secret) return new Response('Not Found', { status: 404 })

  try {
    const discovery = await getDiscovery(cfg)
    // ?next=/join/<token> — вернуть после входа на исходный экран (только
    // внутренний путь, гард sanitizeNextPath от open-redirect).
    const next = sanitizeNextPath(req.nextUrl.searchParams.get('next'))
    const tx = {
      state: generateRawToken(),
      nonce: generateRawToken(),
      verifier: generatePkce().verifier,
      ...(next ? { next } : {}),
    }

    const res = NextResponse.redirect(buildAuthorizeUrl(cfg, discovery, tx), 302)
    res.cookies.set('radar_oidc_tx', sealTransaction(tx, secret), {
      httpOnly: true,
      sameSite: 'lax', // lax: cookie доедет на top-level redirect-навигации от Радара
      secure: cfg.redirectUri.startsWith('https://'),
      path: '/auth/vk',
      maxAge: 600, // 10 минут на прохождение входа у Радара
    })
    return res
  } catch (err) {
    // Радар недоступен (discovery упал) — возвращаем на /login с подсказкой,
    // email-вход при этом работает.
    console.error('[auth/vk/start]', err)
    return NextResponse.redirect(
      new URL('/login?error=vk', process.env.NEXT_PUBLIC_SERVER_URL || req.nextUrl.origin),
      302,
    )
  }
}
