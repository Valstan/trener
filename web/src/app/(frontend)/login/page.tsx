import type { Metadata } from 'next'
import Link from 'next/link'
import React from 'react'

import { getRadarConfig } from '@/lib/auth/oidc'

import { LoginForm } from './LoginForm'

// Страница входа: единый вход Малмыжа (вход.вмалмыже.рф, Радар-ID — один аккаунт на
// все проекты экосистемы) + magic-link по email как fallback. Кнопка единого входа
// видна, только если SSO сконфигурирован. Динамическая: наличие SSO решается
// env-переменными в РАНТАЙМЕ (standalone-прод собирается в CI без секретов — на
// билде кнопки «не было бы»). К БД страница по-прежнему не обращается.
//
// ⚠️ VK — не сам провайдер, а один из upstream-методов ВНУТРИ единого входа
// (пока единственный живой; magic-link/Telegram — Ф2/Ф3 Радара). Поэтому кнопка
// названа «Войти через Малмыж», а не «через VK»: метод выбирается уже на Радаре.
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
  const ssoEnabled = getRadarConfig() !== null

  return (
    <main className="page" style={{ maxWidth: 460 }}>
      <div style={{ textAlign: 'center', padding: '2rem 0 1.5rem' }}>
        <div aria-hidden style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>
          ⚽
        </div>
        <h1 style={{ fontSize: '1.6rem', margin: '0 0 0.35rem' }}>Вход</h1>
        <p style={{ color: 'var(--muted)', margin: 0 }}>
          {ssoEnabled
            ? 'Войдите через единый аккаунт Малмыжа, по ссылке на email или по паролю.'
            : 'Войдите по ссылке на email или по паролю, если задали его в аккаунте.'}
        </p>
      </div>
      {error === 'vk' && (
        <div className="card card-muted" role="alert" style={{ marginBottom: '1rem' }}>
          Не получилось войти через Малмыж. Попробуйте ещё раз — или войдите по email ниже.
        </div>
      )}
      {ssoEnabled && (
        <>
          {/* Обычная ссылка (не Link): /auth/vk/start — серверный redirect-маршрут
              единого входа (вход.вмалмыже.рф), клиентская навигация Next не нужна. */}
          <a className="btn btn-primary btn-block" href="/auth/vk/start">
            Войти через Малмыж
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
