import config from '@payload-config'
import Link from 'next/link'
import { getPayload } from 'payload'
import React from 'react'

import { peekLoginToken } from '@/lib/auth/magicLink'

import { CompleteLogin } from './CompleteLogin'

// Лендинг magic-link из письма. Серверно проверяем, что токен валиден (есть, не
// использован, не истёк) — но НЕ гасим его здесь: гашение на явном POST-шаге
// (кнопка → /auth/complete-login), чтобы префетч ссылки почтовиком не сжёг вход.
export const dynamic = 'force-dynamic'

const container: React.CSSProperties = {
  maxWidth: 480,
  margin: '0 auto',
  padding: '4rem 1.5rem',
  minHeight: '100vh',
}

const VerifyPage = async ({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>
}) => {
  const { token } = await searchParams

  let valid = false
  if (token) {
    try {
      const payload = await getPayload({ config })
      valid = await peekLoginToken(payload, token)
    } catch {
      valid = false
    }
  }

  return (
    <main style={container}>
      {valid && token ? (
        <CompleteLogin token={token} />
      ) : (
        <>
          <h1 style={{ fontSize: '1.5rem' }}>Ссылка недействительна</h1>
          <p style={{ color: 'var(--muted)' }}>
            Ссылка для входа истекла или уже была использована. Запросите новую.
          </p>
          <p>
            <Link href="/login">← Запросить ссылку заново</Link>
          </p>
        </>
      )}
    </main>
  )
}

export default VerifyPage
