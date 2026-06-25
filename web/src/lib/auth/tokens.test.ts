import { describe, it, expect } from 'vitest'

import { generateRawToken, hashToken } from './tokens'

describe('generateRawToken', () => {
  it('каждый вызов даёт новый токен (криптослучайность)', () => {
    const a = generateRawToken()
    const b = generateRawToken()
    expect(a).not.toEqual(b)
  })

  it('url-safe (base64url): без +, /, =', () => {
    for (let i = 0; i < 20; i++) {
      expect(generateRawToken()).toMatch(/^[A-Za-z0-9_-]+$/)
    }
  })

  it('достаточная длина (32 байта → ~43 символа base64url)', () => {
    expect(generateRawToken().length).toBeGreaterThanOrEqual(43)
  })
})

describe('hashToken', () => {
  it('детерминирован: один вход → один хеш (иначе верификация не сматчит)', () => {
    const raw = generateRawToken()
    expect(hashToken(raw)).toEqual(hashToken(raw))
  })

  it('разные токены → разные хеши', () => {
    expect(hashToken('a')).not.toEqual(hashToken('b'))
  })

  it('хеш — hex sha256 (64 символа), не сам токен (в БД не утекает сырой)', () => {
    const raw = generateRawToken()
    const hash = hashToken(raw)
    expect(hash).toMatch(/^[0-9a-f]{64}$/)
    expect(hash).not.toEqual(raw)
  })

  it('известный вектор sha256 (защита от подмены алгоритма)', () => {
    // sha256("abc")
    expect(hashToken('abc')).toEqual(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    )
  })
})
