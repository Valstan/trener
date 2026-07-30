'use client'

import { useRouter } from 'next/navigation'
import React, { useState } from 'react'

type Option = { id: number; name: string }

// Форма приглашения сотрудника. Роль «администратор филиала» показываем только
// владельцу: админ филиала не раздаёт админские права (сервер это тоже проверяет).
export const StaffInviteForm = ({
  canInviteAdmin,
  branches,
  defaultBranchId,
  groups,
}: {
  canInviteAdmin: boolean
  branches: Option[]
  defaultBranchId: number | null
  groups: Option[]
}) => {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [role, setRole] = useState<'coach' | 'admin'>('coach')
  const [branchId, setBranchId] = useState<number | null>(defaultBranchId ?? branches[0]?.id ?? null)
  const [groupIds, setGroupIds] = useState<number[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState('')

  const toggleGroup = (id: number): void =>
    setGroupIds((prev) => (prev.includes(id) ? prev.filter((v) => v !== id) : [...prev, id]))

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setDone('')
    if (!email.trim() || !name.trim()) {
      setError('Заполните имя и email.')
      return
    }
    if (branchId == null) {
      setError('Выберите филиал.')
      return
    }
    setBusy(true)
    try {
      const res = await fetch('/coach/staff/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, name, role, branchId, groupIds }),
      })
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean
        created?: boolean
        assigned?: number
        reason?: string
      }
      if (res.ok && data.ok) {
        setEmail('')
        setName('')
        setGroupIds([])
        setDone(
          data.created
            ? `✓ Приглашение отправлено${data.assigned ? `, групп назначено: ${data.assigned}` : ''}`
            : '✓ Такой сотрудник уже есть — выслали новую ссылку для входа',
        )
        router.refresh()
        setTimeout(() => setDone(''), 6000)
      } else if (data.reason === 'input') {
        setError('Проверьте имя и адрес почты.')
      } else if (data.reason === 'role' || data.reason === 'branch') {
        setError('Не хватает прав на такое приглашение.')
      } else {
        setError('Не удалось пригласить. Попробуйте ещё раз.')
      }
    } catch {
      setError('Не удалось пригласить. Попробуйте ещё раз.')
    }
    setBusy(false)
  }

  return (
    <form onSubmit={submit} className="stack-sm card" style={{ marginBottom: '1rem' }}>
      <div className="field">
        <label htmlFor="st-name">Имя</label>
        <input
          id="st-name"
          className="input"
          type="text"
          maxLength={120}
          placeholder="например, Иван Петров"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </div>
      <div className="field">
        <label htmlFor="st-email">Email для приглашения</label>
        <input
          id="st-email"
          className="input"
          type="email"
          autoComplete="off"
          placeholder="ivan@example.ru"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>

      {canInviteAdmin && (
        <div className="field">
          <label htmlFor="st-role">Роль</label>
          <select
            id="st-role"
            className="select"
            value={role}
            onChange={(e) => setRole(e.target.value === 'admin' ? 'admin' : 'coach')}
          >
            <option value="coach">Тренер</option>
            <option value="admin">Администратор филиала</option>
          </select>
        </div>
      )}

      {branches.length > 1 && (
        <div className="field">
          <label htmlFor="st-branch">Филиал</label>
          <select
            id="st-branch"
            className="select"
            value={branchId ?? ''}
            onChange={(e) => setBranchId(Number(e.target.value))}
          >
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {role === 'coach' && groups.length > 0 && (
        <div className="stack-sm">
          <span className="muted small">Группы, которые он будет вести (можно позже):</span>
          <div className="row" style={{ gap: '0.35rem', flexWrap: 'wrap' }}>
            {groups.map((g) => (
              <button
                key={g.id}
                type="button"
                className={groupIds.includes(g.id) ? 'btn btn-primary btn-sm' : 'btn btn-ghost btn-sm'}
                aria-pressed={groupIds.includes(g.id)}
                onClick={() => toggleGroup(g.id)}
              >
                {g.name}
              </button>
            ))}
          </div>
        </div>
      )}

      <button type="submit" className="btn btn-primary" style={{ justifySelf: 'start' }} disabled={busy}>
        {busy ? 'Отправляем…' : 'Пригласить'}
      </button>
      {done && <span className="success-text">{done}</span>}
      {error && (
        <p className="error-text" style={{ margin: 0 }}>
          {error}
        </p>
      )}
    </form>
  )
}
