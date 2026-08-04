'use client'

import { useRouter } from 'next/navigation'
import React, { useState } from 'react'

type Option = { id: number; name: string }

export const TopicComposer = ({ groups, branches, canSchool }: { groups: Option[]; branches: Option[]; canSchool: boolean }) => {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [scope, setScope] = useState<'group' | 'branch' | 'school'>('group')
  const [groupId, setGroupId] = useState(groups[0]?.id ?? -1)
  const [branchId, setBranchId] = useState(branches[0]?.id ?? -1)
  const [room, setRoom] = useState<'adults' | 'children'>('adults')
  const [title, setTitle] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  if (!open) return <button type="button" className="btn btn-ghost" style={{ marginBottom: '1rem' }} onClick={() => setOpen(true)}>+ Создать чат</button>

  return <form className="stack-sm card" style={{ marginBottom: '1rem' }} onSubmit={async (event) => {
    event.preventDefault(); setBusy(true); setError('')
    const response = await fetch('/chat/topic', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ scope, groupId, branchId, room, title }) })
    const data = await response.json().catch(() => ({})) as { id?: number }
    if (response.ok && data.id) router.push(`/chat/${data.id}`); else { setError('Не удалось создать чат.'); setBusy(false) }
  }}>
    <div className="field"><label htmlFor="chat-scope">Кто видит чат</label><select id="chat-scope" className="select" value={scope} onChange={(event) => { const value = event.target.value as typeof scope; setScope(value); if (value !== 'group') setRoom('adults') }}>
      <option value="group">Одна группа</option>{branches.length > 0 && <option value="branch">Весь филиал</option>}{canSchool && <option value="school">Вся школа</option>}
    </select></div>
    {scope === 'group' && <div className="field"><label htmlFor="chat-group">Группа</label><select id="chat-group" className="select" value={groupId} onChange={(event) => setGroupId(Number(event.target.value))}>{groups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}</select></div>}
    {scope === 'branch' && <div className="field"><label htmlFor="chat-branch">Филиал</label><select id="chat-branch" className="select" value={branchId} onChange={(event) => setBranchId(Number(event.target.value))}>{branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}</select></div>}
    {scope === 'group' && <div className="field"><label htmlFor="chat-room">Комната</label><select id="chat-room" className="select" value={room} onChange={(event) => setRoom(event.target.value === 'children' ? 'children' : 'adults')}><option value="adults">Взрослая</option><option value="children">Детская</option></select></div>}
    <div className="field"><label htmlFor="chat-title">Название</label><input id="chat-title" className="input" maxLength={120} required value={title} onChange={(event) => setTitle(event.target.value)} /></div>
    <div className="row"><button className="btn btn-primary" disabled={busy} type="submit">Создать</button><button className="btn btn-ghost" type="button" onClick={() => setOpen(false)}>Отмена</button></div>{error && <p className="error-text">{error}</p>}
  </form>
}
