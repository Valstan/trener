import type { Metadata, Viewport } from 'next'
import React from 'react'

import './globals.css'
import { InstallPrompt } from './components/InstallPrompt'
import { ServiceWorkerRegister } from './components/ServiceWorkerRegister'

// Метаданные: страницу собираются продвигать и мерить (D-017), поэтому кроме
// title/description задаём шаблон заголовка и OpenGraph — ссылка, отправленная
// директору школы в мессенджер, должна разворачиваться в осмысленную карточку.
const SITE_URL = process.env.NEXT_PUBLIC_SERVER_URL || 'https://интер.вмалмыже.рф'
const SITE_DESCRIPTION =
  'Расписание тренировок, уведомления об изменениях с подтверждением от родителей и учёт оплат абонементов — для детской спортивной школы.'

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: 'Футбольная школа', template: '%s — Футбольная школа' },
  description: SITE_DESCRIPTION,
  openGraph: {
    type: 'website',
    locale: 'ru_RU',
    url: SITE_URL,
    siteName: 'Футбольная школа',
    title: 'Футбольная школа — координатор тренировок',
    description: SITE_DESCRIPTION,
  },
  // PWA (PR3): manifest Next впрыскивает сам из app/manifest.ts. apple-touch —
  // иконка при «добавить на экран» в iOS; appleWebApp — полноэкранный режим.
  icons: { apple: '/icons/apple-touch-icon.png' },
  appleWebApp: { capable: true, statusBarStyle: 'default', title: 'Футбол' },
}

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f5f7f2' },
    { media: '(prefers-color-scheme: dark)', color: '#0a1813' },
  ],
}

const themeBoot = `try{var t=localStorage.getItem('trener-theme');if(t==='light'||t==='dark')document.documentElement.dataset.theme=t}catch(e){}`

const RootLayout = ({ children }: { children: React.ReactNode }) => (
  <html lang="ru" suppressHydrationWarning>
    <head>
      <script dangerouslySetInnerHTML={{ __html: themeBoot }} />
    </head>
    <body>
      <ServiceWorkerRegister />
      {children}
      <InstallPrompt />
    </body>
  </html>
)

export default RootLayout
