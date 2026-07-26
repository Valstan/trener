'use client'

import { useRouter } from 'next/navigation'
import React, { useState } from 'react'

// Селектор контекста филиала (только владелец, M5 PR-D). POST /coach/branch
// пишет httpOnly-cookie → refresh перечитывает серверные страницы в новом
// контексте. «Все филиалы» = сброс cookie.
export const BranchSwitcher = ({
  branches,
  current,
}: {
  branches: { id: number; name: string }[]
  current: number | null
}) => {
  const router = useRouter()
  const [busy, setBusy] = useState(false)

  const change = async (value: string) => {
    setBusy(true)
    try {
      await fetch('/coach/branch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ branchId: value ? Number(value) : null }),
      })
      router.refresh()
    } catch {
      // молча: следующий выбор повторит
    }
    setBusy(false)
  }

  return (
    <div className="field" style={{ marginBottom: '0.75rem' }}>
      <label htmlFor="branch-ctx" className="muted small">
        🏢 Филиал
      </label>
      <select
        id="branch-ctx"
        className="select"
        value={current ?? ''}
        disabled={busy}
        onChange={(e) => change(e.target.value)}
      >
        <option value="">Все филиалы</option>
        {branches.map((b) => (
          <option key={b.id} value={b.id}>
            {b.name}
          </option>
        ))}
      </select>
    </div>
  )
}
