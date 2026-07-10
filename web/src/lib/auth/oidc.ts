import { createHash, createHmac, randomBytes, timingSafeEqual } from 'crypto'

import { createRemoteJWKSet, jwtVerify } from 'jose'
import type { JWTPayload } from 'jose'

// ── OIDC-клиент центра авторизации «Радар-ID» (Сарафан/setka) ────────────────
//
// Контракт ратифицирован Мозгом 2026-06-30 (docs/auth-sso-vk.md §4):
// Authorization Code + PKCE (S256) + state + nonce; id_token RS256 по jwks_uri;
// claims sub / email / email_verified / name. Роли Радар НЕ диктует — trener
// назначает локально (см. radarLink.ts).
//
// Всё протокольное — стандартными средствами: подпись/JWKS — jose (та же
// библиотека, что внутри Payload), никакой самодельной крипты.

export type RadarConfig = {
  issuer: string
  clientId: string
  clientSecret: string
  redirectUri: string
}

// Issuer и redirect_uri обязаны совпадать с регистрацией клиента в Радаре
// СИМВОЛ-В-СИМВОЛ. Домены кириллические → в проводе всегда punycode (G108):
// WHATWG URL Node сам punycod-ит hostname, поэтому нормализуем через new URL().
// «интер.вмалмыже.рф» и «xn--e1afpni…» после нормализации равны.
export const normalizeUrl = (raw: string): string | null => {
  try {
    return new URL(raw).toString().replace(/\/$/, '')
  } catch {
    return null
  }
}

// SSO сконфигурирован = заданы все три RADAR_*-переменные. Иначе возвращаем null:
// кнопка на /login не рендерится, маршруты /auth/vk/* отвечают 404 — dev без
// Радара работает как раньше (magic-link). Читаем env на каждый вызов (runtime
// standalone-прода, не build-time).
export const getRadarConfig = (): RadarConfig | null => {
  const issuerRaw = process.env.RADAR_ISSUER_URL
  const clientId = process.env.RADAR_CLIENT_ID
  const clientSecret = process.env.RADAR_CLIENT_SECRET
  if (!issuerRaw || !clientId || !clientSecret) return null

  const issuer = normalizeUrl(issuerRaw)
  const serverUrl = process.env.NEXT_PUBLIC_SERVER_URL ?? ''
  const redirectUri = normalizeUrl(
    process.env.RADAR_REDIRECT_URI || `${serverUrl}/auth/vk/callback`,
  )
  if (!issuer || !redirectUri) return null

  return { issuer, clientId, clientSecret, redirectUri }
}

// ── Discovery (/.well-known/openid-configuration) ────────────────────────────

type DiscoveryDoc = {
  issuer: string
  authorization_endpoint: string
  token_endpoint: string
  jwks_uri: string
}

// Кэш discovery на процесс: документ меняется только при передеплое Радара.
// TTL держит баланс «не дёргать Радар на каждый вход / подхватить смену за час».
const DISCOVERY_TTL_MS = 60 * 60_000
let discoveryCache: { issuer: string; doc: DiscoveryDoc; fetchedAt: number } | null = null

export const getDiscovery = async (cfg: RadarConfig): Promise<DiscoveryDoc> => {
  const now = Date.now()
  if (
    discoveryCache &&
    discoveryCache.issuer === cfg.issuer &&
    now - discoveryCache.fetchedAt < DISCOVERY_TTL_MS
  ) {
    return discoveryCache.doc
  }

  const res = await fetch(`${cfg.issuer}/.well-known/openid-configuration`, {
    signal: AbortSignal.timeout(10_000),
  })
  if (!res.ok) throw new Error(`Radar discovery failed: HTTP ${res.status}`)
  const doc = (await res.json()) as Partial<DiscoveryDoc>

  if (
    doc.issuer !== cfg.issuer ||
    !doc.authorization_endpoint ||
    !doc.token_endpoint ||
    !doc.jwks_uri
  ) {
    throw new Error('Radar discovery document is malformed or issuer mismatch')
  }

  const full = doc as DiscoveryDoc
  discoveryCache = { issuer: cfg.issuer, doc: full, fetchedAt: now }
  return full
}

// Один remote-JWKS на процесс: jose кэширует ключи и сам дотягивает их при
// незнакомом kid (ротация ключа Радара подхватывается без рестарта).
let jwksCache: { uri: string; jwks: ReturnType<typeof createRemoteJWKSet> } | null = null

const jwksFor = (uri: string): ReturnType<typeof createRemoteJWKSet> => {
  if (!jwksCache || jwksCache.uri !== uri) {
    jwksCache = { uri, jwks: createRemoteJWKSet(new URL(uri)) }
  }
  return jwksCache.jwks
}

// ── PKCE + транзакционная cookie (state/nonce/verifier между start и callback) ─

// S256: challenge = base64url(sha256(verifier)) — RFC 7636.
export const generatePkce = (): { verifier: string; challenge: string } => {
  const verifier = randomBytes(32).toString('base64url')
  return { verifier, challenge: pkceChallenge(verifier) }
}

export const pkceChallenge = (verifier: string): string =>
  createHash('sha256').update(verifier).digest('base64url')

// next — куда вернуть пользователя после входа (напр. /join/<token>, чтобы принять
// приглашение уже залогиненным). Только внутренний путь — см. sanitizeNextPath.
export type OidcTransaction = { state: string; nonce: string; verifier: string; next?: string }

// Гард open-redirect: принимаем ТОЛЬКО внутренний абсолютный путь ('/x…', но не
// '//host' и не 'https://…'), разумной длины. Всё прочее → null (редирект по роли).
export const sanitizeNextPath = (raw: string | null | undefined): string | null => {
  if (typeof raw !== 'string') return null
  if (raw.length < 2 || raw.length > 512) return null
  if (!raw.startsWith('/') || raw.startsWith('//') || raw.includes('\\')) return null
  return raw
}

// Транзакция OIDC живёт в httpOnly-cookie между /start и /callback. Подписываем
// HMAC'ом (PAYLOAD_SECRET), чтобы подброшенная/подделанная cookie не прошла
// state-проверку молча (cookie-tossing): без валидной подписи транзакции нет.
const txHmac = (data: string, secret: string): string =>
  createHmac('sha256', secret).update(data).digest('base64url')

export const sealTransaction = (tx: OidcTransaction, secret: string): string => {
  const data = Buffer.from(JSON.stringify(tx)).toString('base64url')
  return `${data}.${txHmac(data, secret)}`
}

export const openTransaction = (sealed: string, secret: string): OidcTransaction | null => {
  const dot = sealed.lastIndexOf('.')
  if (dot <= 0) return null
  const data = sealed.slice(0, dot)
  const sig = sealed.slice(dot + 1)
  const expected = txHmac(data, secret)
  const a = Buffer.from(sig)
  const b = Buffer.from(expected)
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null
  try {
    const parsed = JSON.parse(Buffer.from(data, 'base64url').toString()) as OidcTransaction
    if (
      typeof parsed.state !== 'string' ||
      typeof parsed.nonce !== 'string' ||
      typeof parsed.verifier !== 'string' ||
      !parsed.state ||
      !parsed.nonce ||
      !parsed.verifier
    ) {
      return null
    }
    // next — опциональный; невалидный молча отбрасываем (вход продолжится по роли).
    const next = sanitizeNextPath(parsed.next)
    return {
      state: parsed.state,
      nonce: parsed.nonce,
      verifier: parsed.verifier,
      ...(next ? { next } : {}),
    }
  } catch {
    return null
  }
}

// ── Authorize URL / обмен кода / валидация id_token ──────────────────────────

export const buildAuthorizeUrl = (
  cfg: RadarConfig,
  discovery: DiscoveryDoc,
  tx: OidcTransaction,
): string => {
  const u = new URL(discovery.authorization_endpoint)
  u.searchParams.set('response_type', 'code')
  u.searchParams.set('client_id', cfg.clientId)
  u.searchParams.set('redirect_uri', cfg.redirectUri)
  u.searchParams.set('scope', 'openid profile email')
  u.searchParams.set('state', tx.state)
  u.searchParams.set('nonce', tx.nonce)
  u.searchParams.set('code_challenge', pkceChallenge(tx.verifier))
  u.searchParams.set('code_challenge_method', 'S256')
  return u.toString()
}

// code → токены. Аутентификация клиента — client_secret_post (Радар поддерживает
// basic/post/none; post избегает граблей с url-кодированием basic-заголовка).
export const exchangeCode = async (
  cfg: RadarConfig,
  discovery: DiscoveryDoc,
  code: string,
  verifier: string,
): Promise<{ idToken: string }> => {
  const res = await fetch(discovery.token_endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: cfg.redirectUri,
      client_id: cfg.clientId,
      client_secret: cfg.clientSecret,
      code_verifier: verifier,
    }),
    signal: AbortSignal.timeout(10_000),
  })
  if (!res.ok) throw new Error(`Radar token endpoint: HTTP ${res.status}`)
  const json = (await res.json()) as { id_token?: unknown }
  if (typeof json.id_token !== 'string' || !json.id_token) {
    throw new Error('Radar token response has no id_token')
  }
  return { idToken: json.id_token }
}

// Личность, которую удостоверил Радар. email — только как строка с '@' и в
// нижнем регистре; emailVerified строго boolean true (иначе связывание по email
// запрещено — анти-захват, см. radarLink.ts).
export type RadarClaims = {
  sub: string
  email: string | null
  emailVerified: boolean
  name: string | null
}

// Чистая выжимка claims из проверенного JWT-payload (тестируем юнитом).
export const extractClaims = (payload: JWTPayload): RadarClaims => {
  const sub = typeof payload.sub === 'string' ? payload.sub.trim() : ''
  if (!sub) throw new Error('id_token has no sub')

  const emailRaw = typeof payload.email === 'string' ? payload.email.trim().toLowerCase() : ''
  const email = emailRaw.includes('@') ? emailRaw : null
  const nameRaw = typeof payload.name === 'string' ? payload.name.trim() : ''

  return {
    sub,
    email,
    emailVerified: payload.email_verified === true,
    name: nameRaw || null,
  }
}

// Полная проверка id_token: подпись по JWKS Радара + iss + aud + exp (jose) +
// nonce (replay). Возвращает claims личности.
export const verifyIdToken = async (
  cfg: RadarConfig,
  discovery: DiscoveryDoc,
  idToken: string,
  nonce: string,
): Promise<RadarClaims> => {
  const { payload } = await jwtVerify(idToken, jwksFor(discovery.jwks_uri), {
    issuer: discovery.issuer,
    audience: cfg.clientId,
    algorithms: ['RS256'],
  })
  if (payload.nonce !== nonce) throw new Error('id_token nonce mismatch')
  return extractClaims(payload)
}
