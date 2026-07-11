'use client'

import React, { useState } from 'react'

// Вход по email: два режима — magic-link (ссылка на почту, по умолчанию) и пароль
// (для тех, кто задал постоянный пароль в «Аккаунте»). Переключаются ссылкой.
//
// magic-link: ответ сервера всегда одинаков (анти-enumeration) → нейтральный экран.
// пароль: неверные данные → generic-ошибка (существование email не раскрываем).
type Mode = 'link' | 'password'

export const LoginForm = () => {
  const [mode, setMode] = useState<Mode>('link')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const requestLink = async () => {
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
  }

  const passwordLogin = async () => {
    try {
      const res = await fetch('/auth/password-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; redirect?: string }
      if (res.ok && data.ok) {
        window.location.href = data.redirect || '/'
        return
      }
      setError('Неверный email или пароль.')
    } catch {
      setError('Не удалось войти. Попробуйте ещё раз.')
    }
  }

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    if (mode === 'link') await requestLink()
    else await passwordLogin()
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

      {mode === 'password' && (
        <div className="field">
          <label htmlFor="login-password">Пароль</label>
          <input
            id="login-password"
            className="input"
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
      )}

      <button type="submit" disabled={loading} className="btn btn-primary btn-block">
        {loading
          ? mode === 'link'
            ? 'Отправляем…'
            : 'Входим…'
          : mode === 'link'
            ? 'Получить ссылку для входа'
            : 'Войти'}
      </button>

      {error && (
        <p className="error-text" style={{ margin: 0, textAlign: 'center' }}>
          {error}
        </p>
      )}

      <button
        type="button"
        className="btn btn-ghost btn-block"
        onClick={() => {
          setMode(mode === 'link' ? 'password' : 'link')
          setError('')
        }}
      >
        {mode === 'link' ? 'Войти по паролю' : 'Войти по ссылке на email'}
      </button>
    </form>
  )
}
