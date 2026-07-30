'use client'

import React, { useState } from 'react'

// Выход из аккаунта. Зовём ШТАТНЫЙ payload-эндпоинт `/api/users/logout`, а не свой
// маршрут: он и убивает серверную сессию (чистит `user.sessions[sid]` — иначе украденный
// JWT продолжал бы работать до истечения), и гасит cookie `payload-token` штатным
// `generateExpiredPayloadCookie`. Свой маршрут пришлось бы дублировать обе половины
// вручную и держать в синхроне с внутренностями Payload.
//
// После успеха уводим на '/' жёстким переходом (не router.push): все экраны
// force-dynamic и кешируются на клиенте, мягкая навигация могла бы показать
// отрендеренный «под старой сессией» экран.
export const LogoutButton = () => {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const logout = async () => {
    setError('')
    setBusy(true)
    try {
      const res = await fetch('/api/users/logout', { method: 'POST' })
      if (res.ok) {
        window.location.assign('/')
        return
      }
      setError('Не удалось выйти. Попробуйте ещё раз.')
    } catch {
      setError('Не удалось выйти. Попробуйте ещё раз.')
    }
    setBusy(false)
  }

  return (
    <div className="stack-sm">
      <button type="button" className="btn btn-ghost" onClick={logout} disabled={busy}>
        {busy ? 'Выходим…' : 'Выйти из аккаунта'}
      </button>
      {error && (
        <p className="error-text" style={{ margin: 0 }}>
          {error}
        </p>
      )}
    </div>
  )
}
