import type { Metadata, Viewport } from 'next'
import React from 'react'

import { SITE_DESCRIPTION, SITE_URL } from '@/lib/site'

import './globals.css'
import { AppearanceControls } from './components/ThemeToggle'
import { InstallPrompt } from './components/InstallPrompt'
import { ServiceWorkerRegister } from './components/ServiceWorkerRegister'

// Метаданные: страницу собираются продвигать и мерить (D-017), поэтому кроме
// title/description задаём шаблон заголовка и OpenGraph — ссылка, отправленная
// директору школы в мессенджер, должна разворачиваться в осмысленную карточку.

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  // Имя и город в заголовке (D-088, срез Мозга 12.09): «Футбольная школа» не
  // отличает нас ни от одной другой школы в стране — ни для человека в выдаче, ни
  // для нейросети, которую спрашивают «куда записать ребёнка в Малмыже».
  title: {
    default: 'Интер — футбольная школа в Малмыже',
    template: '%s — Интер, футбольная школа в Малмыже',
  },
  description: SITE_DESCRIPTION,
  // Канонический адрес. './' — НЕ опечатка и не «корень сайта»: Next резолвит
  // относительный canonical от metadataBase И текущего пути, поэтому каждая страница
  // получает СВОЙ канонический адрес. Абсолютная строка здесь означала бы G312 —
  // canonical в корневом layout наследуется каждой страницей, и весь сайт объявил бы
  // себя копией главной. Проверено тестом рядом (canonical.test.ts) и сборкой.
  alternates: { canonical: './' },
  openGraph: {
    type: 'website',
    locale: 'ru_RU',
    url: SITE_URL,
    siteName: 'Интер — футбольная школа в Малмыже',
    title: 'Интер — футбольная школа в Малмыже',
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

const themeBoot = `try{var t=localStorage.getItem('trener-theme');if(t==='light'||t==='dark')document.documentElement.dataset.theme=t;var s=localStorage.getItem('trener-style');document.documentElement.dataset.style=s==='football'?'football':'classic'}catch(e){document.documentElement.dataset.style='classic'}`

const RootLayout = ({ children }: { children: React.ReactNode }) => (
  <html lang="ru" suppressHydrationWarning>
    <head>
      <script dangerouslySetInnerHTML={{ __html: themeBoot }} />
    </head>
    <body>
      <ServiceWorkerRegister />
      <AppearanceControls />
      <div className="football-prop-rack" aria-hidden>
        <span className="football-prop football-prop-whistle" />
        <span className="football-prop football-prop-boot" />
        <span className="football-prop football-prop-gloves" />
        <span className="football-prop football-prop-cones" />
      </div>
      {children}
      <InstallPrompt />
    </body>
  </html>
)

export default RootLayout
