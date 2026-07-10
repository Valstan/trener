import { describe, expect, it } from 'vitest'

import { linkDecision, syntheticRadarEmail } from './radarLink'

const verified = { email: 'olga@example.ru', emailVerified: true }
const unverified = { email: 'olga@example.ru', emailVerified: false }
const noEmail = { email: null, emailVerified: false }

describe('linkDecision — security-гейт связывания Радар-личности', () => {
  it('уже связан по sub → login (email даже не смотрим)', () => {
    expect(linkDecision(true, false, false, verified)).toBe('login')
    expect(linkDecision(true, true, true, noEmail)).toBe('login')
  })

  it('verified email + существующий аккаунт → link-email (бесшовный вход invite-родителя)', () => {
    expect(linkDecision(false, true, false, verified)).toBe('link-email')
  })

  it('verified email, аккаунта нет → create-with-email', () => {
    expect(linkDecision(false, false, false, verified)).toBe('create-with-email')
  })

  it('АНТИ-ЗАХВАТ: неподтверждённый email НЕ связывает с существующим аккаунтом', () => {
    // VK-аккаунт с чужим невериф. email не должен «прилипнуть» к персоналу
    expect(linkDecision(false, true, false, unverified)).toBe('create-opaque')
  })

  it('АНТИ-ЗАХВАТ: аккаунт с этим email уже связан с ДРУГИМ sub → не перепривязываем', () => {
    expect(linkDecision(false, true, true, verified)).toBe('create-opaque')
  })

  it('без email → отдельный пользователь со служебным адресом', () => {
    expect(linkDecision(false, false, false, noEmail)).toBe('create-opaque')
  })
})

describe('syntheticRadarEmail — служебный email для соц-only личности', () => {
  it('детерминирован (повторный вход того же sub идемпотентен)', () => {
    expect(syntheticRadarEmail('ABC-123')).toBe(syntheticRadarEmail('ABC-123'))
  })

  it('выглядит как email, домен .invalid (RFC 2606 — не маршрутизируется)', () => {
    expect(syntheticRadarEmail('550e8400-e29b-41d4-a716-446655440000')).toBe(
      'radar-550e8400-e29b-41d4-a716-446655440000@sso.invalid',
    )
  })

  it('экзотические символы sub вычищаются (валидный local-part)', () => {
    expect(syntheticRadarEmail('a b/c@d')).toBe('radar-abcd@sso.invalid')
  })
})
