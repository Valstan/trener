import { createHash, randomBytes } from 'crypto'

// ── Сырые одноразовые токены для magic-link ─────────────────────────────────
//
// generateRawToken — криптослучайный токен (32 байта энтропии → base64url),
// уходит в письмо/URL. hashToken — sha256-хеш, который ЕДИНСТВЕННЫЙ ложится в БД
// (LoginTokens.tokenHash): утечка таблицы не раскрывает живые ссылки.
//
// sha256 без соли здесь достаточен: вход — высокоэнтропийный токен (не пароль),
// перебор по словарю/радужным таблицам неприменим.

export const generateRawToken = (): string => randomBytes(32).toString('base64url')

export const hashToken = (raw: string): string => createHash('sha256').update(raw).digest('hex')
