'use client'

import { useRouter } from 'next/navigation'
import React, { useState } from 'react'

// Форма реплики в нитке чата M4 (общая для тренера и родителя — различается только
// action-эндпоинт). Status-машина формы как у composer'ов; на успехе router.refresh —
// SSR-нитка перерисуется со свежим сообщением.
export const ReplyForm = ({ action, placeholder }: { action: string; placeholder: string }) => {
  const router = useRouter()
  const [body, setBody] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    const text = body.trim()
    if (!text) {
      setError('Напишите сообщение.')
      return
    }
    setBusy(true)
    setError('')
    try {
      const res = await fetch(action, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: text }),
      })
      const data = (await res.json()) as { ok?: boolean }
      if (res.ok && data.ok) {
        setBody('')
        router.refresh()
      } else {
        setError('Не удалось отправить. Попробуйте ещё раз.')
      }
    } catch {
      setError('Не удалось отправить. Попробуйте ещё раз.')
    }
    setBusy(false)
  }

  return (
    <form onSubmit={submit} className="stack-sm">
      <textarea
        className="textarea"
        placeholder={placeholder}
        maxLength={1000}
        value={body}
        onChange={(e) => setBody(e.target.value)}
      />
      <button type="submit" className="btn btn-primary" style={{ justifySelf: 'start' }} disabled={busy}>
        {busy ? 'Отправляем…' : 'Отправить'}
      </button>
      {error && (
        <p className="error-text" style={{ margin: 0 }}>
          {error}
        </p>
      )}
    </form>
  )
}
