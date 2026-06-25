import type { Payload } from 'payload'

import { generateRawToken, hashToken } from './tokens'

// Срок жизни magic-link. Коротко (30 мин) — узкое окно для перехвата/повтора.
export const LOGIN_TOKEN_TTL_MINUTES = 30

// Создаёт одноразовый login-токен для СУЩЕСТВУЮЩЕГО пользователя и возвращает сырой
// токен (для ссылки). Если пользователя с таким email нет — возвращает null, но
// наружу это не раскрывается (защита от перебора существующих email).
export const createLoginToken = async (
  payload: Payload,
  email: string,
): Promise<string | null> => {
  const normalizedEmail = email.trim().toLowerCase()
  if (!normalizedEmail) return null

  const users = await payload.find({
    collection: 'users',
    where: { email: { equals: normalizedEmail } },
    limit: 1,
    depth: 0,
    pagination: false,
    overrideAccess: true,
  })
  const user = users.docs[0]
  if (!user) return null

  const raw = generateRawToken()
  const expiresAt = new Date(Date.now() + LOGIN_TOKEN_TTL_MINUTES * 60_000).toISOString()

  await payload.create({
    collection: 'login-tokens',
    data: {
      tokenHash: hashToken(raw),
      purpose: 'login',
      email: normalizedEmail,
      user: user.id,
      expiresAt,
    },
    overrideAccess: true,
  })

  return raw
}

// Находит валидный (неиспользованный, непросроченный) login-токен по сырому значению —
// БЕЗ мутации. Для verify-страницы: решить, показывать кнопку входа или ошибку.
export const peekLoginToken = async (payload: Payload, rawToken: string): Promise<boolean> => {
  if (!rawToken) return false
  const found = await payload.find({
    collection: 'login-tokens',
    where: {
      and: [{ tokenHash: { equals: hashToken(rawToken) } }, { usedAt: { exists: false } }],
    },
    limit: 1,
    depth: 0,
    pagination: false,
    overrideAccess: true,
  })
  const tok = found.docs[0]
  if (!tok) return false
  return new Date(tok.expiresAt).getTime() >= Date.now()
}

export type ConsumeResult = { ok: true; userId: number | string } | { ok: false }

// АВТОРИТЕТНЫЙ консьюм: находит валидный токен, помечает использованным (single-use)
// и возвращает id пользователя для выписки сессии. Повторный вызов с тем же токеном
// уже не сматчит (usedAt проставлен).
export const consumeLoginToken = async (
  payload: Payload,
  rawToken: string,
): Promise<ConsumeResult> => {
  if (!rawToken) return { ok: false }

  const found = await payload.find({
    collection: 'login-tokens',
    where: {
      and: [{ tokenHash: { equals: hashToken(rawToken) } }, { usedAt: { exists: false } }],
    },
    limit: 1,
    depth: 0,
    pagination: false,
    overrideAccess: true,
  })
  const tok = found.docs[0]
  if (!tok) return { ok: false }
  if (new Date(tok.expiresAt).getTime() < Date.now()) return { ok: false }

  // single-use: гасим токен сразу.
  await payload.update({
    collection: 'login-tokens',
    id: tok.id,
    data: { usedAt: new Date().toISOString() },
    overrideAccess: true,
  })

  const userId = typeof tok.user === 'object' && tok.user !== null ? tok.user.id : tok.user
  if (userId === undefined || userId === null) return { ok: false }

  return { ok: true, userId }
}
