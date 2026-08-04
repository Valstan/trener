'use client'

import { useRouter } from 'next/navigation'
import React, { useState } from 'react'

export const ChildApprovalRequests = ({ requests }: { requests: { id: number; childName: string; dateOfBirth: string }[] }) => {
  const router = useRouter(); const [busy, setBusy] = useState<number | null>(null)
  if (!requests.length) return null
  return <><h2 className="section-title">Подтвердите ребёнка</h2><div className="stack-sm">{requests.map((request) => <article className="card stack-sm" key={request.id}><strong>{request.childName}</strong><span className="muted small">Дата рождения: {new Date(request.dateOfBirth).toLocaleDateString('ru-RU')}</span><div className="row"><button className="btn btn-primary" disabled={busy != null} onClick={async () => { setBusy(request.id); await fetch('/account/child-request/respond', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ requestId: request.id, accept: true }) }); router.refresh() }}>Это мой ребёнок</button><button className="btn btn-ghost" disabled={busy != null} onClick={async () => { setBusy(request.id); await fetch('/account/child-request/respond', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ requestId: request.id, accept: false }) }); router.refresh() }}>Отклонить</button></div></article>)}</div></>
}
