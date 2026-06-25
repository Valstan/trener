'use client'

import React, { useState } from 'react'

// Форма приёма приглашения: родитель вводит email → /auth/accept-invite. Ответ
// нейтральный (анти-enumeration), поэтому после отправки показываем «проверьте почту».
export const JoinForm = ({ token }: { token: string }) => {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      await fetch('/auth/accept-invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, email }),
      })
    } catch {
      // best-effort — нейтральный экран ниже в любом случае
    }
    setSent(true)
    setLoading(false)
  }

  if (sent) {
    return (
      <p style={{ marginTop: '1.5rem' }}>
        Мы отправили ссылку для подтверждения на указанный email. Проверьте почту — ссылка
        действует ограниченное время.
      </p>
    )
  }

  return (
    <form onSubmit={onSubmit} style={{ marginTop: '1.5rem', display: 'grid', gap: '0.75rem' }}>
      <label htmlFor="email" style={{ fontSize: '0.9rem', color: 'var(--muted)' }}>
        Ваш email
      </label>
      <input
        id="email"
        type="email"
        required
        autoFocus
        autoComplete="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="you@example.ru"
        style={{
          padding: '0.65rem 0.75rem',
          fontSize: '1rem',
          borderRadius: 8,
          border: '1px solid #ccc',
        }}
      />
      <button
        type="submit"
        disabled={loading}
        style={{
          padding: '0.7rem 1.25rem',
          fontSize: '1rem',
          cursor: loading ? 'default' : 'pointer',
          borderRadius: 8,
          border: 'none',
          background: '#0b1f17',
          color: '#fff',
        }}
      >
        {loading ? 'Отправляем…' : 'Получить ссылку для входа'}
      </button>
    </form>
  )
}
