'use client'

import { useRouter } from 'next/navigation'
import React, { useState } from 'react'

type GroupOption = { id: number; name: string }

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
    <form onSubmit={submit} className="stack-sm card">
      {groups.length > 1 && (
        <div className="field">
          <label htmlFor="ann-group">Группа</label>
          <select
            id="ann-group"
            className="select"
            value={groupId}
            onChange={(e) => setGroupId(Number(e.target.value))}
          >
            {groups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
        </div>
      )}
      <input
        className="input"
        type="text"
        placeholder="Заголовок"
        maxLength={140}
        value={title}
        onChange={(e) => setTitle(e.target.value)}
      />
      <textarea
        className="textarea"
        placeholder="Текст объявления"
        maxLength={2000}
        value={body}
        onChange={(e) => setBody(e.target.value)}
      />
      <label className="check-row">
        <input type="checkbox" checked={triggersPush} onChange={(e) => setTriggersPush(e.target.checked)} />
        Уведомить пушем (best-effort)
      </label>
      <button type="submit" className="btn btn-primary" style={{ justifySelf: 'start' }} disabled={busy}>
        {busy ? 'Отправляем…' : 'Отправить'}
      </button>
      {done && <span className="success-text">✓ Отправлено</span>}
      {error && <p className="error-text" style={{ margin: 0 }}>{error}</p>}
    </form>
  )
}
