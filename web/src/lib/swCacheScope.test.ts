import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

// Аудит #057 (векторы c, d): service worker кэшировал ВСЕ авторизованные страницы
// как HTML. Ключ кэша — только URL, без пользователя, поэтому содержимое сессии
// переживало выход и читалось офлайн на чужом/украденном устройстве. Тест смотрит на
// исходник: логика живёт в public/sw.js, который не поднять юнитом, а правило
// «забыть его легче всего при правке соседней строки».
// public/sw.js лежит на уровень выше src/, поэтому путь отсчёта — от корня web/.
const src = (rel: string): string =>
  readFileSync(fileURLToPath(new URL(`../../${rel}`, import.meta.url)), 'utf8')

const sw = src('public/sw.js')
const logout = src('src/app/(frontend)/account/LogoutButton.tsx')

const AUTH_PREFIXES = [
  '/home',
  '/pending',
  '/parent',
  '/child',
  '/account',
  '/chat',
  '/coach',
  '/payment-chat',
  '/match',
  '/demo',
]

describe('service worker: ПДн не остаются в Cache Storage', () => {
  it.each(AUTH_PREFIXES)('авторизованный префикс %s в NO_STORE', (prefix) => {
    expect(sw).toContain(`'${prefix}'`)
  })

  it('публичные страницы остались в кэше (офлайн-вид нужен)', () => {
    const list = sw.match(/NO_STORE_PREFIXES = \[([^\]]*)\]/s)?.[1] ?? ''
    expect(list).not.toContain("'/privacy'")
    expect(list).not.toContain("'/offline'")
  })

  it('есть обработчик команды очистки кэша', () => {
    expect(sw).toMatch(/addEventListener\('message'/)
    expect(sw).toMatch(/TRENER_PURGE_CACHE/)
    expect(sw).toMatch(/caches\.delete\(k\)/)
  })

  it('LogoutButton шлёт команду очистки перед уходом со страницы', () => {
    expect(logout).toMatch(/TRENER_PURGE_CACHE/)
    // postMessage доставляется асинхронно — нужен небольшой зазор до location.assign.
    expect(logout).toMatch(/setTimeout\(resolve, 150\)/)
    const purgeIdx = logout.indexOf('TRENER_PURGE_CACHE')
    const assignIdx = logout.indexOf("window.location.assign('/')")
    expect(purgeIdx).toBeGreaterThan(-1)
    expect(purgeIdx).toBeLessThan(assignIdx)
  })
})
