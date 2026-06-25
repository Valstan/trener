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

export type ConsumeResult =
  | { ok: true; kind: 'login'; userId: number | string }
  | { ok: true; kind: 'invite'; email: string; playerId: number | string }
  | { ok: false }

const relId = (rel: unknown): number | string | null => {
  if (rel === undefined || rel === null) return null
  if (typeof rel === 'object') {
    const id = (rel as { id?: number | string }).id
    return id ?? null
  }
  return rel as number | string
}

export type TokenShape = { player?: unknown; user?: unknown; email?: unknown; expiresAt: string }
export type TokenClass =
  | { kind: 'login'; userId: number | string }
  | { kind: 'invite'; email: string; playerId: number | string }
  | { kind: 'invalid' }

// Чистый security-гейт классификации токена (без БД — потому тестируем юнитом):
//   • invite — player И непустой email (доказанный адрес родителя).
//   • login  — задан user.
//   • invalid— просрочен ИЛИ join-токен (player без email): прямой POST join-ссылки
//              в complete НЕ должен логинить/создавать аккаунт на пустой email.
export const classifyToken = (tok: TokenShape, now: number): TokenClass => {
  if (new Date(tok.expiresAt).getTime() < now) return { kind: 'invalid' }
  const playerId = relId(tok.player)
  const userId = relId(tok.user)
  const email = typeof tok.email === 'string' ? tok.email.trim() : ''
  if (playerId !== null && email !== '') return { kind: 'invite', email, playerId }
  if (userId !== null) return { kind: 'login', userId }
  return { kind: 'invalid' }
}

// АВТОРИТЕТНЫЙ консьюм magic-link-токена. Находит валидный токен, определяет его тип
// и помечает использованным (single-use) — но ТОЛЬКО если токен действительно
// консьюмабелен (login или invite-accept), чтобы зонд join-ссылкой её не сжигал.
//
//   • login        — token.user задан → вход существующего пользователя.
//   • invite-accept— token.player И непустой token.email → онбординг родителя
//                    (создать/найти аккаунт по доказанному email + привязать ребёнка).
//
// Join-токен (player задан, email пуст) сюда не попадает как валидный: он лишь
// peek'ается на /join и гасится в acceptInvite. Прямой POST join-токена в complete
// даёт { ok:false } и НЕ гасит токен (см. порядок ниже).
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

  // Классифицируем ДО гашения — невалидный/join-токен не помечаем использованным
  // (иначе зонд join-ссылкой её сжёг бы).
  const cls = classifyToken(tok, Date.now())
  if (cls.kind === 'invalid') return { ok: false }

  // single-use: гасим токен.
  await payload.update({
    collection: 'login-tokens',
    id: tok.id,
    data: { usedAt: new Date().toISOString() },
    overrideAccess: true,
  })

  return cls.kind === 'invite'
    ? { ok: true, kind: 'invite', email: cls.email, playerId: cls.playerId }
    : { ok: true, kind: 'login', userId: cls.userId }
}
