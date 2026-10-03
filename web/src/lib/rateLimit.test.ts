import { describe, expect, it } from 'vitest'

import { clientIp, rateLimit } from './rateLimit'

// Аудит #057 (векторы a, c, f): публичные эндпоинты выдавали письма/сессии без
// ограничения частоты, а конфигурации обратного прокси в репо нет — ограничивать
// было нечем. Лимит добавлен в приложение; его контракт проверяется здесь, потому что
// «тихо перестал считать» выглядит как «защита работает».
const req = (ip: string, headers: Record<string, string> = {}): Request =>
  new Request('https://example.test/x', { headers: { 'x-forwarded-for': ip, ...headers } })

describe('rateLimit: скользящее окно по IP', () => {
  it('пропускает до лимита и режет дальше', () => {
    const name = 'test:a'
    for (let i = 0; i < 3; i += 1) {
      expect(rateLimit(req('1.1.1.1'), { name, limit: 3, windowMs: 60_000 })).toBe(true)
    }
    expect(rateLimit(req('1.1.1.1'), { name, limit: 3, windowMs: 60_000 })).toBe(false)
  })

  it('разные IP не мешают друг другу', () => {
    const name = 'test:b'
    expect(rateLimit(req('2.2.2.2'), { name, limit: 1, windowMs: 60_000 })).toBe(true)
    expect(rateLimit(req('3.3.3.3'), { name, limit: 1, windowMs: 60_000 })).toBe(true)
    expect(rateLimit(req('2.2.2.2'), { name, limit: 1, windowMs: 60_000 })).toBe(false)
  })

  it('разные эндпоинты не мешают друг другу', () => {
    expect(rateLimit(req('4.4.4.4'), { name: 'test:c1', limit: 1, windowMs: 60_000 })).toBe(true)
    expect(rateLimit(req('4.4.4.4'), { name: 'test:c2', limit: 1, windowMs: 60_000 })).toBe(true)
    expect(rateLimit(req('4.4.4.4'), { name: 'test:c1', limit: 1, windowMs: 60_000 })).toBe(false)
  })

  it('окно истёкшее — счётчик сброшен', async () => {
    const name = 'test:d'
    expect(rateLimit(req('5.5.5.5'), { name, limit: 1, windowMs: 10 })).toBe(true)
    expect(rateLimit(req('5.5.5.5'), { name, limit: 1, windowMs: 10 })).toBe(false)
    await new Promise((resolve) => setTimeout(resolve, 20))
    expect(rateLimit(req('5.5.5.5'), { name, limit: 1, windowMs: 10 })).toBe(true)
  })

  it('IP берётся из x-forwarded-for, при отсутствии — x-real-ip, иначе unknown', () => {
    expect(clientIp(req('6.6.6.6'))).toBe('6.6.6.6')
    expect(clientIp(new Request('https://x.test/', { headers: { 'x-real-ip': '7.7.7.7' } }))).toBe('7.7.7.7')
    expect(clientIp(new Request('https://x.test/'))).toBe('unknown')
  })
})
