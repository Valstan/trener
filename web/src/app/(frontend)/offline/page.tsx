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
  <main className="page" style={{ textAlign: 'center', maxWidth: 480 }}>
    <div style={{ paddingTop: '3rem' }}>
      <div style={{ fontSize: '3rem', marginBottom: '1rem' }} aria-hidden>
        📡
      </div>
      <h1 className="page-title">Нет соединения</h1>
      <p className="muted">
        Интернет сейчас недоступен. Уже открытые страницы остаются под рукой, а как только связь
        вернётся — расписание и уведомления обновятся сами.
      </p>
      <p className="note" style={{ marginTop: '1.5rem' }}>
        <Link href="/">На главную →</Link>
      </p>
    </div>
  </main>
)

export default OfflinePage
