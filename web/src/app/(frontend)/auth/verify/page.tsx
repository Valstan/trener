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
    <main className="page" style={{ maxWidth: 460 }}>
      {valid && token ? (
        <CompleteLogin token={token} />
      ) : (
        <div style={{ textAlign: 'center', paddingTop: '2rem' }}>
          <div aria-hidden style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>
            ⚽
          </div>
          <h1 className="page-title">Ссылка недействительна</h1>
          <p className="muted">Ссылка для входа истекла или уже была использована. Запросите новую.</p>
          <p className="note" style={{ marginTop: '1.5rem' }}>
            <Link href="/login">← Запросить ссылку заново</Link>
          </p>
        </div>
      )}
    </main>
  )
}

export default VerifyPage
