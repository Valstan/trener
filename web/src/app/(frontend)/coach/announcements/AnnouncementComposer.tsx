'use client'

import { useRouter } from 'next/navigation'
import React, { useState } from 'react'

type GroupOption = { id: number; name: string }

const field: React.CSSProperties = {
  width: '100%',
  padding: '0.6rem 0.7rem',
  borderRadius: 8,
  border: '1px solid #2a4636',
  background: '#0e2218',
  color: 'var(--fg)',
  fontSize: '0.95rem',
  fontFamily: 'inherit',
}

const submitBtn = (busy: boolean): React.CSSProperties => ({
  padding: '0.6rem 1.2rem',
  fontSize: '0.95rem',
  cursor: busy ? 'default' : 'pointer',
  borderRadius: 8,
  border: 'none',
  background: busy ? '#9aa6a0' : 'var(--accent)',
  color: '#fff',
  justifySelf: 'start',
})

// Компоновщик объявления: группа + заголовок + текст + флаг пуша. Status-машина формы
// (idle→submitting→success), как RegistrationForm Sabantuy. На успехе — router.refresh,
// чтобы свежее объявление появилось в списке ниже.
export const AnnouncementComposer = ({ groups }: { groups: GroupOption[] }) => {
  const router = useRouter()
  const [groupId, setGroupId] = useState<number>(groups[0]?.id ?? -1)
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [triggersPush, setTriggersPush] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim() || !body.trim()) {
      setError('Заполните заголовок и текст.')
      return
    }
    setBusy(true)
    setError('')
    try {
      const res = await fetch('/coach/announcement', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ groupId, title: title.trim(), body: body.trim(), triggersPush }),
      })
      const data = (await res.json()) as { ok?: boolean }
      if (res.ok && data.ok) {
        setTitle('')
        setBody('')
        setTriggersPush(false)
        setDone(true)
        router.refresh()
        setTimeout(() => setDone(false), 2500)
      } else {
        setError('Не удалось отправить. Попробуйте ещё раз.')
      }
    } catch {
      setError('Не удалось отправить. Попробуйте ещё раз.')
    }
    setBusy(false)
  }

  return (
    <form onSubmit={submit} style={{ display: 'grid', gap: '0.6rem' }}>
      {groups.length > 1 && (
        <label style={{ display: 'grid', gap: '0.25rem' }}>
          <span style={{ color: 'var(--muted)', fontSize: '0.85rem' }}>Группа</span>
          <select style={field} value={groupId} onChange={(e) => setGroupId(Number(e.target.value))}>
            {groups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
        </label>
      )}
      <input
        style={field}
        type="text"
        placeholder="Заголовок"
        maxLength={140}
        value={title}
        onChange={(e) => setTitle(e.target.value)}
      />
      <textarea
        style={{ ...field, minHeight: 90, resize: 'vertical' }}
        placeholder="Текст объявления"
        maxLength={2000}
        value={body}
        onChange={(e) => setBody(e.target.value)}
      />
      <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9rem' }}>
        <input type="checkbox" checked={triggersPush} onChange={(e) => setTriggersPush(e.target.checked)} />
        Уведомить пушем (best-effort)
      </label>
      <button type="submit" style={submitBtn(busy)} disabled={busy}>
        {busy ? 'Отправляем…' : 'Отправить'}
      </button>
      {done && <span style={{ color: 'var(--accent)', fontWeight: 600 }}>✓ Отправлено</span>}
      {error && <p style={{ color: '#e07a6b', margin: 0 }}>{error}</p>}
    </form>
  )
}
