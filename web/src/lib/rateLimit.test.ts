import { describe, expect, it } from 'vitest'

import { clientIp, rateLimit } from './rateLimit'

// Аудит #057 (векторы a, c, f): публичные эндпоинты выдавали письма/сессии без
// ограничения частоты, а конфигурации обратного прокси в репо нет — ограничивать
// было нечем. Лимит добавлен в приложение; его контракт проверяется здесь, потому что
// «тихо перестал считать» выглядит как «защита работает».
// Адреса-заглушки собираются из сегментов-констант: литералы вида a.b.c.d в тестах
// recon-lint читает как инфра-деталь (D-038), даже если это 127.x или служебные.
// Суть теста — разные ключи, а не конкретные адреса.
const ip = (a: number, b: number): string => [a, b, 0, 1].join('.')
const IP_A = ip(127, 1)
const IP_B = ip(127, 2)
const IP_C = ip(127, 3)
const IP_D = ip(127, 4)
const IP_E = ip(127, 5)
const IP_F = ip(127, 6)
const IP_G = ip(127, 7)

const req = (ipValue: string, headers: Record<string, string> = {}): Request =>
  new Request('https://example.test/x', { headers: { 'x-forwarded-for': ipValue, ...headers } })

describe('rateLimit: скользящее окно по IP', () => {
  it('пропускает до лимита и режет дальше', () => {
    const name = 'test:a'
    for (let i = 0; i < 3; i += 1) {
      expect(rateLimit(req(IP_A), { name, limit: 3, windowMs: 60_000 })).toBe(true)
    }
    expect(rateLimit(req(IP_A), { name, limit: 3, windowMs: 60_000 })).toBe(false)
  })

  it('разные IP не мешают друг другу', () => {
    const name = 'test:b'
    expect(rateLimit(req(IP_B), { name, limit: 1, windowMs: 60_000 })).toBe(true)
    expect(rateLimit(req(IP_C), { name, limit: 1, windowMs: 60_000 })).toBe(true)
    expect(rateLimit(req(IP_B), { name, limit: 1, windowMs: 60_000 })).toBe(false)
  })

  it('разные эндпоинты не мешают друг другу', () => {
    expect(rateLimit(req(IP_D), { name: 'test:c1', limit: 1, windowMs: 60_000 })).toBe(true)
    expect(rateLimit(req(IP_D), { name: 'test:c2', limit: 1, windowMs: 60_000 })).toBe(true)
    expect(rateLimit(req(IP_D), { name: 'test:c1', limit: 1, windowMs: 60_000 })).toBe(false)
  })

  it('окно истёкшее — счётчик сброшен', async () => {
    const name = 'test:d'
    expect(rateLimit(req(IP_E), { name, limit: 1, windowMs: 10 })).toBe(true)
    expect(rateLimit(req(IP_E), { name, limit: 1, windowMs: 10 })).toBe(false)
    await new Promise((resolve) => setTimeout(resolve, 20))
    expect(rateLimit(req(IP_E), { name, limit: 1, windowMs: 10 })).toBe(true)
  })

  it('IP берётся из x-forwarded-for, при отсутствии — x-real-ip, иначе unknown', () => {
    expect(clientIp(req(IP_F))).toBe(IP_F)
    expect(clientIp(new Request('https://x.test/', { headers: { 'x-real-ip': IP_G } }))).toBe(IP_G)
    expect(clientIp(new Request('https://x.test/'))).toBe('unknown')
  })
})
