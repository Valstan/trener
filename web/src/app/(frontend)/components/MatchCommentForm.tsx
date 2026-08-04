'use client'

import { useRouter } from 'next/navigation'
import React, { useState } from 'react'

export const MatchCommentForm = ({ matchId }: { matchId: number }) => {
  const router = useRouter()
  const [body, setBody] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  return <form className="stack-sm card" onSubmit={async (event) => {
    event.preventDefault()
    if (!body.trim()) return
    setBusy(true); setError('')
    const response = await fetch('/match/comment', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ matchId, body }) })
    if (response.ok) { setBody(''); router.refresh() } else setError('Не удалось отправить комментарий.')
    setBusy(false)
  }}>
    <label htmlFor="match-comment"><strong>Оставить комментарий</strong></label>
    <textarea id="match-comment" className="textarea" maxLength={2000} rows={3} value={body} onChange={(event) => setBody(event.target.value)} />
    <button className="btn btn-primary" disabled={busy || !body.trim()} type="submit">{busy ? 'Отправляем…' : 'Отправить'}</button>
    {error && <p className="error-text">{error}</p>}
  </form>
}
