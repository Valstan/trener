'use client'

import { useRouter } from 'next/navigation'
import React, { useState } from 'react'

// Подтверждение ребёнком заявки родителя (бэклог п.10): код ответа сервера
// проверяется — 403/404/409 показываются текстом, а не выглядят успехом.
export const ChildApprovalRequests = ({
  requests,
}: {
  requests: { id: number; childName: string; dateOfBirth: string }[]
}) => {
  const router = useRouter()
  const [busy, setBusy] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)

  const respond = async (requestId: number, accept: boolean) => {
    setBusy(requestId)
    setError(null)
    try {
      const res = await fetch('/account/child-request/respond', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestId, accept }),
      })
      const data = (await res.json().catch(() => null)) as { ok?: boolean } | null
      if (!res.ok || !data?.ok) {
        setError('Не удалось сохранить ответ — попробуйте ещё раз.')
        setBusy(null)
        return
      }
      router.refresh()
    } catch {
      setError('Не удалось сохранить ответ — попробуйте ещё раз.')
      setBusy(null)
    }
  }

  if (!requests.length) return null
  return (
    <>
      <h2 className="section-title">Подтвердите ребёнка</h2>
      {error && <p className="error-text">{error}</p>}
      <div className="stack-sm">
        {requests.map((request) => (
          <article className="card stack-sm" key={request.id}>
            <strong>{request.childName}</strong>
            <span className="muted small">
              Дата рождения: {new Date(request.dateOfBirth).toLocaleDateString('ru-RU')}
            </span>
            <div className="row">
              <button
                className="btn btn-primary"
                disabled={busy != null}
                onClick={() => respond(request.id, true)}
              >
                Это мой ребёнок
              </button>
              <button
                className="btn btn-ghost"
                disabled={busy != null}
                onClick={() => respond(request.id, false)}
              >
                Отклонить
              </button>
            </div>
          </article>
        ))}
      </div>
    </>
  )
}
