'use client'

import React, { useState } from 'react'

// Форма установки/смены пароля. Логин (email) показан только для чтения — он же
// используется на входе по паролю. Требует ≥8 символов и совпадения подтверждения.
const MIN = 8

export const AccountForm = ({ email }: { email: string }) => {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setDone(false)
    if (password.length < MIN) {
      setError(`Пароль должен быть не короче ${MIN} символов.`)
      return
    }
    if (password !== confirm) {
      setError('Пароли не совпадают.')
      return
    }
    setBusy(true)
    try {
      const res = await fetch('/auth/set-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      })
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; reason?: string }
      if (res.ok && data.ok) {
        setPassword('')
        setConfirm('')
        setDone(true)
      } else if (data.reason === 'weak') {
        setError(`Пароль должен быть не короче ${MIN} символов.`)
      } else {
        setError('Не удалось сохранить пароль. Попробуйте ещё раз.')
      }
    } catch {
      setError('Не удалось сохранить пароль. Попробуйте ещё раз.')
    }
    setBusy(false)
  }

  return (
    <div className="stack-sm">
      <div className="field">
        <label htmlFor="acc-login">Ваш логин (email)</label>
        <input id="acc-login" className="input" type="email" value={email} readOnly />
      </div>

      <h2 className="section-title">Пароль для входа</h2>
      <p className="muted small" style={{ marginTop: 0 }}>
        Задайте постоянный пароль — и сможете входить по email и паролю, без ссылки на почту.
      </p>

      <form onSubmit={submit} className="stack-sm card">
        <div className="field">
          <label htmlFor="acc-pass">Новый пароль</label>
          <input
            id="acc-pass"
            className="input"
            type="password"
            autoComplete="new-password"
            placeholder="не короче 8 символов"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="acc-confirm">Повторите пароль</label>
          <input
            id="acc-confirm"
            className="input"
            type="password"
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
        </div>
        <button type="submit" className="btn btn-primary" style={{ justifySelf: 'start' }} disabled={busy}>
          {busy ? 'Сохраняем…' : 'Сохранить пароль'}
        </button>
        {done && <span className="success-text">✓ Пароль сохранён</span>}
        {error && (
          <p className="error-text" style={{ margin: 0 }}>
            {error}
          </p>
        )}
      </form>
    </div>
  )
}
