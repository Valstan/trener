import type { Metadata } from 'next'
import React from 'react'

import { LoginForm } from './LoginForm'

// Страница входа по magic-link. Статична (без обращения к БД на сборке) — форма
// шлёт запрос на /auth/request-login уже в рантайме из браузера.
export const metadata: Metadata = {
  title: 'Вход — Футбольная школа',
}

const container: React.CSSProperties = {
  maxWidth: 480,
  margin: '0 auto',
  padding: '4rem 1.5rem',
  minHeight: '100vh',
}

const LoginPage = () => (
  <main style={container}>
    <h1 style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>Вход</h1>
    <p style={{ color: 'var(--muted)', marginTop: 0 }}>
      Введите email — пришлём ссылку для входа. Пароль не нужен.
    </p>
    <LoginForm />
  </main>
)

export default LoginPage
