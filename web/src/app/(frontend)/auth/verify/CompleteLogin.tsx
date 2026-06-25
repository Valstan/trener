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
    <>
      <h1 style={{ fontSize: '1.5rem' }}>Вход в Футбольную школу</h1>
      <p style={{ color: 'var(--muted)' }}>Нажмите кнопку, чтобы завершить вход.</p>
      <button
        type="button"
        onClick={onLogin}
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
        {loading ? 'Входим…' : 'Войти в приложение'}
      </button>
      {error && <p style={{ color: '#c0392b', marginTop: '1rem' }}>{error}</p>}
    </>
  )
}
