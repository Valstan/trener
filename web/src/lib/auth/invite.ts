import type { Payload } from 'payload'

import { generateRawToken, hashToken } from './tokens'

// Invite-ссылка (join) живёт дольше login'а — тренер выдаёт её заранее. 14 дней.
const INVITE_TOKEN_TTL_DAYS = 14
// Письмо-подтверждение привязки — короткое окно, как у обычного входа.
export const INVITE_ACCEPT_TTL_MINUTES = 30

const relId = (rel: unknown): number | string | null => {
  if (rel === undefined || rel === null) return null
  if (typeof rel === 'object') return (rel as { id?: number | string }).id ?? null
  return rel as number | string
}

// Тренер/админ генерит join-токен под конкретного ребёнка. purpose 'invite', email
// пуст (родитель ещё неизвестен), player задан. Возвращает сырой токен для /join/<token>.
export const createInviteToken = async (
  payload: Payload,
  playerId: number | string,
): Promise<string> => {
  const raw = generateRawToken()
  const expiresAt = new Date(Date.now() + INVITE_TOKEN_TTL_DAYS * 24 * 60 * 60_000).toISOString()
  await payload.create({
    collection: 'login-tokens',
    data: {
      tokenHash: hashToken(raw),
      purpose: 'invite',
      email: '',
      // Postgres-id ребёнка — number; relId/JSON допускают string, поэтому каст.
      player: playerId as number,
      expiresAt,
    },
    overrideAccess: true,
  })
  return raw
}

export type InvitePreview =
  | { ok: true; playerId: number | string; playerName: string; groupName: string | null }
  | { ok: false }

// Для страницы /join: валиден ли join-токен и какого ребёнка/группу показать.
// Без мутации (гашение — в acceptInvite после доказанного email).
export const peekInviteToken = async (
  payload: Payload,
  rawToken: string,
): Promise<InvitePreview> => {
  if (!rawToken) return { ok: false }
  const found = await payload.find({
    collection: 'login-tokens',
    where: {
      and: [
        { tokenHash: { equals: hashToken(rawToken) } },
        { purpose: { equals: 'invite' } },
        { usedAt: { exists: false } },
      ],
    },
    limit: 1,
    depth: 1,
    pagination: false,
    overrideAccess: true,
  })
  const tok = found.docs[0]
  if (!tok) return { ok: false }
  if (new Date(tok.expiresAt).getTime() < Date.now()) return { ok: false }

  const playerId = relId(tok.player)
  if (playerId === null) return { ok: false }

  const player =
    typeof tok.player === 'object' && tok.player !== null
      ? tok.player
      : await payload
          .findByID({ collection: 'players', id: playerId, depth: 1, overrideAccess: true })
          .catch(() => null)
  if (!player) return { ok: false }

  const group = (player as { group?: unknown }).group
  const groupName =
    typeof group === 'object' && group !== null
      ? ((group as { name?: string }).name ?? null)
      : null

  return {
    ok: true,
    playerId,
    playerName: (player as { name?: string }).name ?? 'ребёнок',
    groupName,
  }
}

// Родитель ввёл email на /join — выписываем ОДНОРАЗОВЫЙ accept-токен (purpose 'invite',
// player + email заданы), который уйдёт письмом. Join-токен пока НЕ гасим (родитель
// мог опечататься в email и переоткрыть /join). Возвращает сырой accept-токен.
// null — если join-токен невалиден.
export const createInviteAcceptToken = async (
  payload: Payload,
  joinRawToken: string,
  email: string,
): Promise<string | null> => {
  const normalizedEmail = email.trim().toLowerCase()
  if (!normalizedEmail || !normalizedEmail.includes('@')) return null

  const preview = await peekInviteToken(payload, joinRawToken)
  if (!preview.ok) return null

  const raw = generateRawToken()
  const expiresAt = new Date(Date.now() + INVITE_ACCEPT_TTL_MINUTES * 60_000).toISOString()
  await payload.create({
    collection: 'login-tokens',
    data: {
      tokenHash: hashToken(raw),
      purpose: 'invite',
      email: normalizedEmail,
      player: preview.playerId as number,
      expiresAt,
    },
    overrideAccess: true,
  })
  return raw
}

export type AcceptResult =
  | { ok: true; userId: number | string }
  | { ok: false; reason: 'claimed' | 'error' }

// Привязка ребёнка к КОНКРЕТНОМУ аккаунту (личность уже доказана: email-токеном
// либо живой сессией — VK/magic-link). Защита 152-ФЗ-привязки:
//   • привязка ТОЛЬКО если у ребёнка ещё нет родителя (idempotent, без перепривязки);
//   • если ребёнок уже привязан к ДРУГОМУ аккаунту — отказ 'claimed' (анти-перехват).
// После успешной привязки гасим открытые invite-токены этого ребёнка (join-ссылка
// больше не действует).
export const linkPlayerToUser = async (
  payload: Payload,
  userId: number | string,
  playerId: number | string,
): Promise<AcceptResult> => {
  const player = await payload
    .findByID({ collection: 'players', id: playerId, depth: 0, overrideAccess: true })
    .catch(() => null)
  if (!player) return { ok: false, reason: 'error' }

  const currentParent = relId((player as { parent?: unknown }).parent)
  if (currentParent !== null && currentParent !== userId) {
    return { ok: false, reason: 'claimed' }
  }
  if (currentParent === null) {
    await payload.update({
      collection: 'players',
      id: playerId,
      data: { parent: userId as number },
      overrideAccess: true,
    })
  }

  // Гасим открытые invite-токены этого ребёнка (включая исходную join-ссылку).
  const open = await payload.find({
    collection: 'login-tokens',
    where: {
      and: [{ player: { equals: playerId } }, { purpose: { equals: 'invite' } }, { usedAt: { exists: false } }],
    },
    limit: 100,
    depth: 0,
    pagination: false,
    overrideAccess: true,
  })
  for (const t of open.docs) {
    await payload.update({
      collection: 'login-tokens',
      id: t.id,
      data: { usedAt: new Date().toISOString() },
      overrideAccess: true,
    })
  }

  return { ok: true, userId }
}

// Доказанное владение email (accept-токен сконсьюмлен) → создаём/находим аккаунт
// родителя и привязываем ребёнка (linkPlayerToUser).
export const acceptInvite = async (
  payload: Payload,
  email: string,
  playerId: number | string,
): Promise<AcceptResult> => {
  const normalizedEmail = email.trim().toLowerCase()
  if (!normalizedEmail) return { ok: false, reason: 'error' }

  const existing = await payload.find({
    collection: 'users',
    where: { email: { equals: normalizedEmail } },
    limit: 1,
    depth: 0,
    pagination: false,
    overrideAccess: true,
  })
  let user = existing.docs[0]
  if (!user) {
    // Локальная стратегия включена → password обязателен. Ставим случайный: родитель
    // его не знает и не использует (вход только по magic-link).
    user = await payload.create({
      collection: 'users',
      data: { email: normalizedEmail, password: generateRawToken(), roles: ['parent'] },
      overrideAccess: true,
    })
  }

  return linkPlayerToUser(payload, user.id, playerId)
}
