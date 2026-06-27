import type { Metadata } from 'next'
import Link from 'next/link'
import React from 'react'

import { LoginForm } from './LoginForm'

// Страница входа по magic-link. Статична (без обращения к БД на сборке) — форма
// шлёт запрос на /auth/request-login уже в рантайме из браузера.
export const metadata: Metadata = {
  title: 'Вход — Футбольная школа',
}

const LoginPage = () => (
  <main className="page" style={{ maxWidth: 460 }}>
    <div style={{ textAlign: 'center', padding: '2rem 0 1.5rem' }}>
      <div aria-hidden style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>
        ⚽
      </div>
      <h1 style={{ fontSize: '1.6rem', margin: '0 0 0.35rem' }}>Вход</h1>
      <p style={{ color: 'var(--muted)', margin: 0 }}>
        Введите email — пришлём ссылку для входа. Пароль не нужен.
      </p>
    </div>
    <LoginForm />
    <p className="note" style={{ textAlign: 'center', marginTop: '2rem' }}>
      <Link href="/">← На главную</Link>
    </p>
  </main>
)

export default LoginPage
