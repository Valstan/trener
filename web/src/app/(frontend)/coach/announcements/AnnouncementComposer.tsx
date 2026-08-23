'use client'

import { useRouter } from 'next/navigation'
import React, { useState } from 'react'

type GroupOption = { id: number; name: string }
type BranchOption = { id: number; name: string }

// Компоновщик объявления: группа + заголовок + текст + флаг пуша. Status-машина формы
// (idle→submitting→success), как RegistrationForm Sabantuy. На успехе — router.refresh,
// чтобы свежее объявление появилось в списке ниже.
//
// M5 PR-C: владельцу (branches != null) доступен охват — группа / выбранные
// филиалы / вся сеть + закрепление баннером. Тренер видит классику без охвата.
export const AnnouncementComposer = ({
  groups,
  branches,
}: {
  groups: GroupOption[]
  branches?: BranchOption[] | null
}) => {
  const router = useRouter()
  const isOwner = Array.isArray(branches)
  const [scope, setScope] = useState<'group' | 'branch' | 'network'>('group')
  const [branchIds, setBranchIds] = useState<number[]>([])
  const [pinned, setPinned] = useState(false)
  const [groupId, setGroupId] = useState<number>(groups[0]?.id ?? -1)
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [triggersPush, setTriggersPush] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  const toggleBranch = (id: number) =>
    setBranchIds((prev) => (prev.includes(id) ? prev.filter((b) => b !== id) : [...prev, id]))

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim() || !body.trim()) {
      setError('Заполните заголовок и текст.')
      return
    }
    if (scope === 'branch' && !branchIds.length) {
      setError('Выберите хотя бы один филиал.')
      return
    }
    setBusy(true)
    setError('')
    try {
      const res = await fetch('/coach/announcement', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          groupId,
          title: title.trim(),
          body: body.trim(),
          triggersPush,
          ...(isOwner ? { scope, branchIds, pinned } : {}),
        }),
      })
      const data = (await res.json()) as { ok?: boolean; error?: string }
      if (res.ok && data.ok) {
        setTitle('')
        setBody('')
        setTriggersPush(false)
        setPinned(false)
        setDone(true)
        router.refresh()
        setTimeout(() => setDone(false), 2500)
      } else {
        // Сервер мог прислать осмысленный текст (например, лимит демо D-029).
        setError(data.error || 'Не удалось отправить. Попробуйте ещё раз.')
      }
    } catch {
      setError('Не удалось отправить. Попробуйте ещё раз.')
    }
    setBusy(false)
  }

  return (
    <form onSubmit={submit} className="stack-sm card">
      {isOwner && (
        <div className="field">
          <label htmlFor="ann-scope">Кому</label>
          <select
            id="ann-scope"
            className="select"
            value={scope}
            onChange={(e) => setScope(e.target.value as 'group' | 'branch' | 'network')}
          >
            <option value="group">Одной группе</option>
            <option value="branch">Выбранным филиалам</option>
            <option value="network">Всей сети</option>
          </select>
        </div>
      )}
      {isOwner && scope === 'branch' && (
        <div className="field">
          <span>Филиалы</span>
          {(branches ?? []).map((b) => (
            <label key={b.id} className="check-row">
              <input
                type="checkbox"
                checked={branchIds.includes(b.id)}
                onChange={() => toggleBranch(b.id)}
              />
              {b.name}
            </label>
          ))}
        </div>
      )}
      {scope === 'group' && groups.length > 1 && (
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
      {isOwner && (
        <label className="check-row">
          <input type="checkbox" checked={pinned} onChange={(e) => setPinned(e.target.checked)} />
          Закрепить сверху ленты (баннер)
        </label>
      )}
      <button type="submit" className="btn btn-primary" style={{ justifySelf: 'start' }} disabled={busy}>
        {busy ? 'Отправляем…' : 'Отправить'}
      </button>
      {done && <span className="success-text">✓ Отправлено</span>}
      {error && <p className="error-text" style={{ margin: 0 }}>{error}</p>}
    </form>
  )
}
