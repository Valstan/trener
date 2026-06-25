import type { Metadata } from 'next'
import Link from 'next/link'
import React from 'react'

/**
 * Офлайн-фолбэк (PWA, веха PR3): отдаётся service worker'ом, когда страница
 * запрошена без сети и её ещё нет в кэше. Статическая, не требует данных/БД.
 */
export const metadata: Metadata = {
  title: 'Нет соединения',
  robots: { index: false, follow: false },
}

const OfflinePage = () => (
  <main
    style={{
      maxWidth: 640,
      margin: '0 auto',
      padding: '4rem 1.5rem',
      minHeight: '100vh',
      textAlign: 'center',
    }}
  >
    <div style={{ fontSize: '3rem', marginBottom: '1rem' }} aria-hidden>
      ⚽
    </div>
    <h1 style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>Нет соединения</h1>
    <p style={{ color: 'var(--muted)' }}>
      Интернет сейчас недоступен. Уже открытые страницы остаются под рукой, а как только связь
      вернётся — расписание и уведомления обновятся сами.
    </p>
    <p>
      <Link href="/">На главную →</Link>
    </p>
  </main>
)

export default OfflinePage
