'use client'

import { useRouter } from 'next/navigation'
import React, { useState } from 'react'

export const AssignParentForm = ({ requestId, parents }: { requestId: number; parents: { id: number; name: string; branch: string }[] }) => {
  const router = useRouter(); const [parentId, setParentId] = useState(parents[0]?.id ?? -1); const [busy, setBusy] = useState(false)
  return <form className="row" onSubmit={async (event) => { event.preventDefault(); setBusy(true); const response = await fetch('/coach/child-requests/assign', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ requestId, parentId }) }); if (response.ok) router.refresh(); else setBusy(false) }}>
    <select className="select" value={parentId} onChange={(event) => setParentId(Number(event.target.value))}>{parents.map((parent) => <option key={parent.id} value={parent.id}>{parent.name} · {parent.branch}</option>)}</select>
    <button className="btn btn-primary" disabled={busy || parentId < 1}>Отправить родителю</button>
  </form>
}
