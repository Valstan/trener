import { describe, it, expect } from 'vitest'

import { classifyToken } from './magicLink'

const NOW = 1_000_000_000_000
const future = new Date(NOW + 60_000).toISOString()
const past = new Date(NOW - 60_000).toISOString()

describe('classifyToken — security-гейт типа токена', () => {
  it('просроченный → invalid (не консьюмится)', () => {
    expect(classifyToken({ user: 7, expiresAt: past }, NOW)).toEqual({ kind: 'invalid' })
  })

  it('login: задан user, нет player → login', () => {
    expect(classifyToken({ user: 7, expiresAt: future }, NOW)).toEqual({ kind: 'login', userId: 7 })
  })

  it('invite: player + непустой email → invite', () => {
    expect(classifyToken({ player: 5, email: 'p@e.ru', expiresAt: future }, NOW)).toEqual({
      kind: 'invite',
      email: 'p@e.ru',
      playerId: 5,
    })
  })

  it('АНТИ-ПЕРЕХВАТ: join-токен (player без email) → invalid', () => {
    // прямой POST join-ссылки в complete не должен логинить/создавать аккаунт
    expect(classifyToken({ player: 5, email: '', expiresAt: future }, NOW)).toEqual({
      kind: 'invalid',
    })
    expect(classifyToken({ player: 5, expiresAt: future }, NOW)).toEqual({ kind: 'invalid' })
    expect(classifyToken({ player: 5, email: '   ', expiresAt: future }, NOW)).toEqual({
      kind: 'invalid',
    })
  })

  it('пустой токен (ни user, ни player) → invalid', () => {
    expect(classifyToken({ expiresAt: future }, NOW)).toEqual({ kind: 'invalid' })
  })

  it('relId: relationship как объект {id} и как скаляр', () => {
    expect(classifyToken({ user: { id: 9 }, expiresAt: future }, NOW)).toEqual({
      kind: 'login',
      userId: 9,
    })
    expect(classifyToken({ player: { id: 3 }, email: 'a@b.ru', expiresAt: future }, NOW)).toEqual({
      kind: 'invite',
      email: 'a@b.ru',
      playerId: 3,
    })
  })

  it('email с пробелами тримится', () => {
    expect(classifyToken({ player: 5, email: '  p@e.ru  ', expiresAt: future }, NOW)).toEqual({
      kind: 'invite',
      email: 'p@e.ru',
      playerId: 5,
    })
  })
})
