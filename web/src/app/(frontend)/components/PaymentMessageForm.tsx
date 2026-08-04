'use client'

import { useRouter } from 'next/navigation'
import React, { useState } from 'react'

export const PaymentMessageForm = ({ threadId, branchId }: { threadId?: number; branchId?: number }) => {
  const router = useRouter()
  const [body, setBody] = useState('')
  const [busy, setBusy] = useState(false)
  return <form className="stack-sm" onSubmit={async (event) => {
    event.preventDefault(); if (!body.trim()) return; setBusy(true)
    const res = await fetch('/payment-chat/message', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ threadId, branchId, body }) })
    if (res.ok) { setBody(''); router.refresh() }
    setBusy(false)
  }}><textarea className="textarea" value={body} maxLength={2000} onChange={(event) => setBody(event.target.value)} placeholder="Сообщение по оплате" /><button className="btn btn-primary" disabled={busy}>{busy ? 'Отправляем…' : 'Отправить'}</button></form>
}
