import type { MetadataRoute } from 'next'

/**
 * Web App Manifest (PWA, веха PR3) → отдаётся как /manifest.webmanifest.
 * ⚠️ Файл-метадата ДОЛЖЕН лежать в КОРНЕ app/, НЕ в route-group (frontend) —
 * иначе Next молча его не генерит (грабля G12, как у robots.ts/sitemap.ts).
 * Next сам впрыскивает <link rel="manifest"> в <head> всех страниц.
 *
 * Манифест и иконки тянутся браузером БЕЗ cookies (credentials: omit) — поэтому
 * лежат на публичных путях, не за auth-гейтом (грабля G59). display: standalone
 * → при «добавить на экран» открывается без браузерной обвязки.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Футбольная школа — координатор',
    short_name: 'Футбол',
    description:
      'Расписание тренировок, уведомления об изменениях и подтверждения для родителей детской футбольной школы.',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    lang: 'ru',
    dir: 'ltr',
    background_color: '#0b1f17',
    theme_color: '#0b1f17',
    categories: ['sports', 'education', 'productivity'],
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      {
        src: '/icons/icon-maskable-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  }
}
