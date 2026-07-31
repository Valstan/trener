import type { Metadata, Viewport } from 'next'
import React from 'react'

import './globals.css'
import { InstallPrompt } from './components/InstallPrompt'
import { ServiceWorkerRegister } from './components/ServiceWorkerRegister'

export const metadata: Metadata = {
  title: 'Футбольная школа',
  description:
    'Расписание, уведомления об изменениях и подтверждения для родителей детской футбольной школы.',
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
