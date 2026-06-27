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
      <div className="card card-accent" style={{ marginTop: '1.5rem', textAlign: 'center' }}>
        <div aria-hidden style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>
          📬
        </div>
        <strong style={{ display: 'block', marginBottom: '0.35rem' }}>Проверьте почту</strong>
        <span className="muted small">
          Мы отправили ссылку для подтверждения на указанный email. Ссылка действует ограниченное
          время.
        </span>
      </div>
    )
  }

  return (
    <form onSubmit={onSubmit} className="stack" style={{ marginTop: '1.5rem' }}>
      <div className="field">
        <label htmlFor="email">Ваш email</label>
        <input
          id="email"
          className="input"
          type="email"
          required
          autoFocus
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.ru"
        />
      </div>
      <button type="submit" disabled={loading} className="btn btn-primary btn-block">
        {loading ? 'Отправляем…' : 'Получить ссылку для входа'}
      </button>
    </form>
  )
}
