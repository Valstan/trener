'use client'

import { useRouter } from 'next/navigation'
import React, { useState } from 'react'

// Форма реплики в тему (M9). Отправка — по кнопке; Enter переносит строку, а не шлёт:
// на телефоне отправка по Enter обрывает сообщение на середине мысли чаще, чем помогает.
export const MessageComposer = ({ topicId }: { topicId: number }) => {
  const router = useRouter()
  const [body, setBody] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!body.trim()) return
    setBusy(true)
    setError('')
    try {
      const res = await fetch('/chat/message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topicId, body }),
      })
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; reason?: string }
      if (res.ok && data.ok) {
        setBody('')
        router.refresh()
      } else if (data.reason === 'closed') {
        setError('Тему закрыли, пока вы писали. Обновите страницу.')
      } else {
        setError('Не удалось отправить. Попробуйте ещё раз.')
      }
    } catch {
      setError('Не удалось отправить. Попробуйте ещё раз.')
    }
    setBusy(false)
  }

  return (
    <form onSubmit={submit} className="stack-sm" style={{ marginTop: '1rem' }}>
      <textarea
        className="textarea"
        rows={3}
        maxLength={2000}
        placeholder="Написать в тему…"
        value={body}
        onChange={(e) => setBody(e.target.value)}
        aria-label="Текст сообщения"
      />
      <button type="submit" className="btn btn-primary" style={{ justifySelf: 'start' }} disabled={busy || !body.trim()}>
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
