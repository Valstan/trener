/*
 * Service worker «Футбольная школа — координатор» (PWA, веха PR3).
 * Рукописный, без зависимостей. Стратегии подобраны так, чтобы НЕ ломать свежесть
 * данных и НЕ кэшировать чувствительное (152-ФЗ — детские ПДн):
 *
 *   • навигации (страницы)  → network-first: онлайн всегда свежая версия,
 *                             без сети → последняя успешная из кэша, иначе /offline.
 *   • статика и медиа       → cache-first: /_next/static и хэш-имена иммутабельны;
 *                             посещённые медиа дают офлайн-вид страниц.
 *   • /admin и /api         → НЕ кэшируем вовсе (кроме /api/media/file/ — GET-картинки).
 *   • auth/онбординг        → отдаём из сети, но НЕ кладём в кэш: токены в URL и
 *                             детские ПДн не должны оседать в Cache Storage на устройстве.
 *
 * Версионируем имя кэша: при изменении логики SW поднять VERSION → activate подчистит старые.
 */
const VERSION = 'v1'
const CACHE = `trener-${VERSION}`
const OFFLINE_URL = '/offline'
// Минимальный предкэш: офлайн-страница + манифест. Остальное кэшируется на лету.
const PRECACHE = [OFFLINE_URL, '/manifest.webmanifest']

// Пути с токенами/детскими ПДн — отдаём из сети, но в Cache Storage не сохраняем.
const NO_STORE_PREFIXES = ['/auth', '/login', '/join', '/onboarding']

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE)
      await cache.addAll(PRECACHE)
      await self.skipWaiting()
    })(),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys()
      await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
      await self.clients.claim()
    })(),
  )
})

function isStaticAsset(url) {
  return (
    url.pathname.startsWith('/_next/static') ||
    url.pathname.startsWith('/icons/') ||
    /\.(?:png|jpe?g|svg|webp|gif|ico|woff2?|css|js)$/.test(url.pathname)
  )
}

function isSensitive(url) {
  return NO_STORE_PREFIXES.some((p) => url.pathname === p || url.pathname.startsWith(`${p}/`))
}

// Кладём в кэш только пригодные ответы (200, same-origin, не редирект —
// сохранённый redirected-ответ ломает воспроизведение навигации).
async function putSafe(request, response) {
  if (!response || !response.ok || response.redirected) return
  const cache = await caches.open(CACHE)
  await cache.put(request, response.clone())
}

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return

  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return

  // Админка и API (кроме медиа-файлов) — всегда из сети, мимо кэша.
  if (url.pathname.startsWith('/admin')) return
  if (url.pathname.startsWith('/api') && !url.pathname.startsWith('/api/media/file/')) return

  // Навигации — network-first; чувствительные пути не сохраняем в кэш.
  if (request.mode === 'navigate') {
    const sensitive = isSensitive(url)
    event.respondWith(
      (async () => {
        try {
          const fresh = await fetch(request)
          if (!sensitive) await putSafe(request, fresh)
          return fresh
        } catch {
          const cached = sensitive ? null : await caches.match(request)
          return cached || (await caches.match(OFFLINE_URL)) || Response.error()
        }
      })(),
    )
    return
  }

  // Статика и медиа — cache-first.
  if (isStaticAsset(url) || url.pathname.startsWith('/api/media/file/')) {
    event.respondWith(
      (async () => {
        const cached = await caches.match(request)
        if (cached) return cached
        try {
          const fresh = await fetch(request)
          await putSafe(request, fresh)
          return fresh
        } catch {
          return cached || Response.error()
        }
      })(),
    )
  }
})
