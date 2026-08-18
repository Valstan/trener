'use client'

import { useRouter } from 'next/navigation'
import React, { useState } from 'react'

export const PaymentMessageForm = ({ threadId, branchId }: { threadId?: number; branchId?: number }) => {
  const router = useRouter()
  const [body, setBody] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  return <form className="stack-sm" onSubmit={async (event) => {
    event.preventDefault(); if (!body.trim()) return; setBusy(true); setError('')
    const res = await fetch('/payment-chat/message', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ threadId, branchId, body }) })
    // Сервер мог прислать осмысленный текст (например, лимит демо D-029).
    const data = (await res.json().catch(() => ({}))) as { error?: string }
    if (res.ok) { setBody(''); router.refresh() } else setError(data.error || 'Не удалось отправить. Попробуйте ещё раз.')
    setBusy(false)
  }}><textarea className="textarea" value={body} maxLength={2000} onChange={(event) => setBody(event.target.value)} placeholder="Сообщение по оплате" /><button className="btn btn-primary" disabled={busy}>{busy ? 'Отправляем…' : 'Отправить'}</button>{error && <p className="error-text" style={{ margin: 0 }}>{error}</p>}</form>
}
