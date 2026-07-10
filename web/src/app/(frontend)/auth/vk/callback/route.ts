import config from '@payload-config'
import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { getPayload } from 'payload'

import { homePathForUser } from '@/lib/auth/home'
import {
  exchangeCode,
  getDiscovery,
  getRadarConfig,
  openTransaction,
  verifyIdToken,
} from '@/lib/auth/oidc'
import { findOrLinkRadarUser } from '@/lib/auth/radarLink'
import { buildAuthCookie } from '@/lib/auth/session'

// GET /auth/vk/callback — возврат из Радара: state против httpOnly-cookie (CSRF),
// одноразовый code → токены (PKCE-verifier + client_secret), валидация id_token
// (подпись JWKS / iss / aud / exp / nonce), связывание личности с аккаунтом
// (findOrLinkRadarUser) → стандартная Payload-сессия → экран по роли.
//
// Любой отказ — мягкий редирект на /login?error=vk: email-вход остаётся рабочим,
// деталей отказа наружу не раскрываем (в лог — да).
export const dynamic = 'force-dynamic'

export const GET = async (req: NextRequest): Promise<Response> => {
  const cfg = getRadarConfig()
  const secret = process.env.PAYLOAD_SECRET
  if (!cfg || !secret) return new Response('Not Found', { status: 404 })

  const serverUrl = process.env.NEXT_PUBLIC_SERVER_URL || req.nextUrl.origin
  const fail = (reason: string): Response => {
    console.error(`[auth/vk/callback] отказ: ${reason}`)
    const res = NextResponse.redirect(new URL('/login?error=vk', serverUrl), 302)
    res.cookies.set('radar_oidc_tx', '', { path: '/auth/vk', maxAge: 0 })
    return res
  }

  const params = req.nextUrl.searchParams
  if (params.get('error')) return fail(`Радар вернул error=${params.get('error')}`)

  const code = params.get('code')
  const state = params.get('state')
  if (!code || !state) return fail('нет code/state в callback')

  const sealed = req.cookies.get('radar_oidc_tx')?.value ?? ''
  const tx = openTransaction(sealed, secret)
  if (!tx) return fail('транзакционная cookie отсутствует/не прошла подпись')
  if (tx.state !== state) return fail('state не совпал (CSRF?)')

  try {
    const discovery = await getDiscovery(cfg)
    const { idToken } = await exchangeCode(cfg, discovery, code, tx.verifier)
    const claims = await verifyIdToken(cfg, discovery, idToken, tx.nonce)

    const payload = await getPayload({ config })
    const user = await findOrLinkRadarUser(payload, claims)
    const authCookie = await buildAuthCookie(payload, user)

    // next из подписанной транзакции (уже прошёл sanitizeNextPath) — например,
    // возврат на /join/<token> для one-click привязки; иначе экран по роли.
    const res = NextResponse.redirect(new URL(tx.next ?? homePathForUser(user), serverUrl), 302)
    res.cookies.set('radar_oidc_tx', '', { path: '/auth/vk', maxAge: 0 })
    res.headers.append('Set-Cookie', authCookie)
    return res
  } catch (err) {
    return fail(err instanceof Error ? err.message : String(err))
  }
}
