'use client'

import { useRouter } from 'next/navigation'
import React, { useState } from 'react'

export const RoleForm = () => {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  return <div className="stack-sm">
    {([['child', 'Ребёнок', 'Я занимаюсь в футбольной школе'], ['parent', 'Родитель', 'Мой ребёнок занимается в школе'], ['coach', 'Тренер', 'Я работаю тренером']] as const).map(([role, title, text]) => <button className="card" style={{ textAlign: 'left' }} disabled={busy} key={role} onClick={async () => {
      setBusy(true)
      const response = await fetch('/onboarding/role/select', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ role }) })
      if (response.ok) router.push(role === 'child' ? '/onboarding/child' : '/pending'); else setBusy(false)
    }}><strong>{title}</strong><span className="muted small" style={{ display: 'block' }}>{text}</span></button>)}
  </div>
}
