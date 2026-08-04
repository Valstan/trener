'use client'

import React, { useState } from 'react'

type Child = { id: number; name: string; dateOfBirth?: string | null; login?: string | null; hasAccount: boolean }

export const ChildAccounts = ({ players }: { players: Child[] }) => {
  const [busy, setBusy] = useState<number | null>(null)
  const [message, setMessage] = useState('')

  if (!players.length) return <p className="muted">Сначала тренер должен добавить ребёнка в группу и привязать его к вам.</p>

  return (
    <div className="stack-sm">
      {players.map((child) => (
        <form
          key={child.id}
          className="card stack-sm"
          onSubmit={async (event) => {
            event.preventDefault()
            setBusy(child.id)
            setMessage('')
            const form = new FormData(event.currentTarget)
            const res = await fetch('/account/child-account', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                playerId: child.id,
                name: form.get('name'),
                dateOfBirth: form.get('dateOfBirth'),
                login: form.get('login'),
                password: form.get('password'),
              }),
            })
            setBusy(null)
            setMessage(res.ok ? 'Аккаунт ребёнка сохранён.' : 'Не удалось сохранить. Проверьте логин и пароль.')
          }}
        >
          <strong>{child.name}</strong>
          <label className="field">Имя и фамилия<input className="input" name="name" defaultValue={child.name} required maxLength={100} /></label>
          <label className="field">Дата рождения<input className="input" name="dateOfBirth" type="date" defaultValue={child.dateOfBirth?.slice(0, 10)} required /></label>
          <label className="field">Логин<input className="input" name="login" defaultValue={child.login ?? ''} required minLength={3} maxLength={32} pattern="[a-zA-Z0-9._-]+" autoCapitalize="none" /></label>
          <label className="field">{child.hasAccount ? 'Новый пароль' : 'Пароль'}<input className="input" name="password" type="password" required minLength={8} autoComplete="new-password" /></label>
          <button className="btn btn-primary" disabled={busy === child.id}>{busy === child.id ? 'Сохраняем…' : child.hasAccount ? 'Обновить аккаунт' : 'Создать аккаунт'}</button>
        </form>
      ))}
      {message && <p className="small">{message}</p>}
    </div>
  )
}
