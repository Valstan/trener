import type { Metadata } from 'next'
import Link from 'next/link'
import React from 'react'

import { getRadarConfig } from '@/lib/auth/oidc'

import { LoginForm } from './LoginForm'

// Страница входа: magic-link по email + (если сконфигурирован Радар-ID) кнопка
// «Войти через VK». Динамическая: наличие SSO решается env-переменными в РАНТАЙМЕ
// (standalone-прод собирается в CI без секретов — на билде кнопки «не было бы»).
// К БД страница по-прежнему не обращается.
export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Вход — Футбольная школа',
}

const LoginPage = async ({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) => {
  const { error } = await searchParams
  const vkEnabled = getRadarConfig() !== null

  return (
    <main className="page" style={{ maxWidth: 460 }}>
      <div style={{ textAlign: 'center', padding: '2rem 0 1.5rem' }}>
        <div aria-hidden style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>
          ⚽
        </div>
        <h1 style={{ fontSize: '1.6rem', margin: '0 0 0.35rem' }}>Вход</h1>
        <p style={{ color: 'var(--muted)', margin: 0 }}>
          {vkEnabled
            ? 'Войдите через VK или получите ссылку на email. Пароль не нужен.'
            : 'Введите email — пришлём ссылку для входа. Пароль не нужен.'}
        </p>
      </div>
      {error === 'vk' && (
        <div className="card card-muted" role="alert" style={{ marginBottom: '1rem' }}>
          Не получилось войти через VK. Попробуйте ещё раз — или войдите по email ниже.
        </div>
      )}
      {vkEnabled && (
        <>
          {/* Обычная ссылка (не Link): /auth/vk/start — серверный redirect-маршрут,
              клиентская навигация Next сюда не нужна. */}
          <a className="btn btn-primary btn-block" href="/auth/vk/start">
            Войти через VK
          </a>
          <p
            className="note"
            style={{ textAlign: 'center', margin: '1.25rem 0 0', color: 'var(--muted)' }}
          >
            или по email
          </p>
        </>
      )}
      <LoginForm />
      <p className="note" style={{ textAlign: 'center', marginTop: '2rem' }}>
        <Link href="/">← На главную</Link>
      </p>
    </main>
  )
}

export default LoginPage
