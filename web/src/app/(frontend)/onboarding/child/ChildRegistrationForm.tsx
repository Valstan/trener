'use client'

import { useRouter } from 'next/navigation'
import React, { useState } from 'react'

export const ChildRegistrationForm = ({ initialName }: { initialName: string }) => {
  const router = useRouter(); const [busy, setBusy] = useState(false); const [error, setError] = useState('')
  return <form className="stack-sm" onSubmit={async (event) => {
    event.preventDefault(); setBusy(true); setError('')
    const data = new FormData(event.currentTarget)
    const response = await fetch('/onboarding/child/submit', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(Object.fromEntries(data)) })
    if (response.ok) router.push('/pending'); else { setError('Проверьте заполненные данные.'); setBusy(false) }
  }}>
    <div className="field"><label htmlFor="child-name">Имя и фамилия ребёнка</label><input id="child-name" name="childName" className="input" defaultValue={initialName} required maxLength={120} /></div>
    <div className="field"><label htmlFor="child-birth">Дата рождения</label><input id="child-birth" name="dateOfBirth" className="input" type="date" required /></div>
    <div className="field"><label htmlFor="parent-name">Имя и фамилия родителя</label><input id="parent-name" name="parentName" className="input" required maxLength={120} /></div>
    <button className="btn btn-primary" disabled={busy} type="submit">Отправить заявку</button>{error && <p className="error-text">{error}</p>}
  </form>
}
