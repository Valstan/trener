import type { Metadata, Viewport } from 'next'
import React from 'react'

import './globals.css'

export const metadata: Metadata = {
  title: 'Футбольная школа — координатор',
  description:
    'Расписание, уведомления об изменениях и подтверждения для родителей детской футбольной школы.',
}

export const viewport: Viewport = {
  themeColor: '#0b1f17',
}

const RootLayout = ({ children }: { children: React.ReactNode }) => (
  <html lang="ru">
    <body>{children}</body>
  </html>
)

export default RootLayout
