'use client'

import { useRouter } from 'next/navigation'
import React, { useState } from 'react'

// Решение по взрослой заявке: роль берётся из requestedRole (владелец её не меняет),
// филиал выбирает владелец. Отклонение удаляет applicant-аккаунт (подтверждение).
const ROLE_LABEL: Record<string, string> = { parent: 'родитель', coach: 'тренер' }

export const AdultRequestRow = ({
  request,
  branches,
}: {
  request: { id: number; name: string; email: string; requestedRole: string }
  branches: { id: number; name: string }[]
}) => {
  const router = useRouter()
  const [branchId, setBranchId] = useState(branches[0]?.id ?? -1)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const decide = async (action: 'approve' | 'reject') => {
    if (action === 'reject' && !window.confirm(`Отклонить заявку и удалить аккаунт ${request.email}?`)) return
    setBusy(true)
    setError('')
    const res = await fetch('/coach/requests/decide', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kind: 'adult', id: request.id, action, branchId }),
    })
    if (res.ok) {
      router.refresh()
    } else {
      const data = (await res.json().catch(() => null)) as { error?: string } | null
      setError(data?.error ?? 'Не удалось сохранить — попробуйте ещё раз.')
      setBusy(false)
    }
  }

  return (
    <article className="card stack-sm">
      <div className="row-between">
        <strong>{request.name || request.email}</strong>
        <span className="badge">{ROLE_LABEL[request.requestedRole] ?? request.requestedRole}</span>
      </div>
      <span className="muted small">{request.email}</span>
      <div className="row" style={{ flexWrap: 'wrap', gap: '0.5rem' }}>
        <select className="select" value={branchId} onChange={(e) => setBranchId(Number(e.target.value))}>
          {branches.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
        <button type="button" className="btn btn-primary" disabled={busy || branchId < 1} onClick={() => decide('approve')}>
          Подтвердить
        </button>
        <button type="button" className="btn" disabled={busy} onClick={() => decide('reject')}>
          Отклонить
        </button>
      </div>
      {error && <span className="muted small">{error}</span>}
    </article>
  )
}
