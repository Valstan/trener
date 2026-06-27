'use client'

import React, { useState } from 'react'

// Запрос magic-link. Ответ сервера всегда одинаков (анти-enumeration), поэтому после
// отправки показываем нейтральное «если аккаунт существует — письмо отправлено».
export const LoginForm = () => {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      await fetch('/auth/request-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
    } catch {
      // best-effort: даже при сетевой ошибке показываем нейтральный экран
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
        <span style={{ color: 'var(--muted)', fontSize: '0.9rem' }}>
          Если аккаунт с этим email существует, мы отправили ссылку для входа. Ссылка действует
          ограниченное время.
        </span>
      </div>
    )
  }

  return (
    <form onSubmit={onSubmit} className="stack" style={{ marginTop: '1.5rem' }}>
      <div className="field">
        <label htmlFor="email">Email</label>
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
