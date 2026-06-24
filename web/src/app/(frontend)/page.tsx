import Link from 'next/link'
import React from 'react'

// Заглушка публичной страницы M1. PWA-клиент родителя/тренера (расписание, уведомления,
// coverage) приходит в M2; онбординг по magic-link — PR2. Страница статична (без обращения
// к БД), чтобы сборка не требовала Postgres.
const HomePage = () => (
  <main
    style={{
      maxWidth: 640,
      margin: '0 auto',
      padding: '4rem 1.5rem',
      minHeight: '100vh',
    }}
  >
    <h1 style={{ fontSize: '1.75rem', marginBottom: '0.5rem' }}>⚽ Футбольная школа</h1>
    <p style={{ color: 'var(--muted)', marginTop: 0 }}>
      Координатор расписания: изменения, уведомления родителям и подтверждения «приняли N из M».
    </p>
    <p>
      Каркас (M1). Клиентское приложение — на следующих этапах.{' '}
      <Link href="/admin">Войти в панель управления →</Link>
    </p>
  </main>
)

export default HomePage
