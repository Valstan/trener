'use client'

import React, { useState } from 'react'

// Явный шаг входа: пользователь нажимает кнопку → POST гасит токен и ставит сессию.
// Никакого авто-submit на mount — иначе префетчер/сканер ссылки мог бы войти за юзера.
export const CompleteLogin = ({ token }: { token: string }) => {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const onLogin = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/auth/complete-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      })
      const data = (await res.json()) as { ok?: boolean; redirect?: string; reason?: string }
      if (res.ok && data.ok) {
        window.location.href = data.redirect || '/'
        return
      }
      if (data.reason === 'claimed') {
        setError('Этот ребёнок уже привязан к другому аккаунту. Обратитесь к тренеру.')
      } else {
        setError('Ссылка недействительна или истекла. Запросите вход заново.')
      }
    } catch {
      setError('Не удалось войти. Попробуйте ещё раз.')
    }
    setLoading(false)
  }

  return (
    <div style={{ textAlign: 'center', paddingTop: '2rem' }}>
      <div aria-hidden style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>
        ⚽
      </div>
      <h1 className="page-title">Вход в Футбольную школу</h1>
      <p className="muted" style={{ marginBottom: '1.5rem' }}>
        Нажмите кнопку, чтобы завершить вход.
      </p>
      <button
        type="button"
        onClick={onLogin}
        disabled={loading}
        className="btn btn-primary btn-block"
        style={{ maxWidth: 320, margin: '0 auto' }}
      >
        {loading ? 'Входим…' : 'Войти в приложение'}
      </button>
      {error && <p className="error-text" style={{ marginTop: '1rem' }}>{error}</p>}
    </div>
  )
}
