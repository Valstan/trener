'use client'

import React, { useState } from 'react'

// One-click приём приглашения залогиненным родителем (вошёл единым входом/magic-link):
// личность доказана сессией, email-раунд не нужен. POST /auth/accept-invite-session.
export const AcceptAsUser = ({ token, email }: { token: string; email: string }) => {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const onAccept = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/auth/accept-invite-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      })
      const data = (await res.json()) as { ok?: boolean; redirect?: string; reason?: string }
      if (data.ok && data.redirect) {
        window.location.assign(data.redirect)
        return
      }
      setError(
        data.reason === 'claimed'
          ? 'Этот ребёнок уже привязан к другому аккаунту. Если это ошибка — обратитесь к тренеру.'
          : 'Не получилось принять приглашение. Попробуйте ещё раз или обновите страницу.',
      )
    } catch {
      setError('Не получилось принять приглашение. Проверьте связь и попробуйте ещё раз.')
    }
    setLoading(false)
  }

  return (
    <div className="stack" style={{ marginTop: '1.5rem' }}>
      <div className="card card-accent">
        Вы вошли как <strong>{email}</strong>. Ребёнок будет привязан к этому аккаунту.
      </div>
      {error && (
        <div className="card card-muted" role="alert">
          {error}
        </div>
      )}
      <button type="button" onClick={onAccept} disabled={loading} className="btn btn-primary btn-block">
        {loading ? 'Привязываем…' : 'Принять приглашение'}
      </button>
    </div>
  )
}
