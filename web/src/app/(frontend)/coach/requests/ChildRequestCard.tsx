'use client'

import { useRouter } from 'next/navigation'
import React, { useState } from 'react'

// Детская заявка в инбоксе владельца.
//   owner_review  → поиск родителя (серверный, вместо выпадашки на 1000 строк) +
//                   «Отправить родителю» / «Отклонить»; ошибки сервера показываются.
//   parent_review → видно, кому передана; «Вернуть на проверку» / «Отклонить»
//                   (раньше зависшая у родителя заявка пропадала из списка навсегда).
type ParentHit = { id: number; name: string; branch: string | null }

export const ChildRequestCard = ({
  request,
}: {
  request: {
    id: number
    childName: string
    dateOfBirth: string
    parentName: string
    status: 'owner_review' | 'parent_review'
    proposedParentName: string | null
  }
}) => {
  const router = useRouter()
  const [q, setQ] = useState('')
  const [hits, setHits] = useState<ParentHit[]>([])
  const [selected, setSelected] = useState<number | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const search = async () => {
    setBusy(true)
    setError('')
    try {
      const res = await fetch(`/coach/requests/parent-search?q=${encodeURIComponent(q)}`)
      const data = (await res.json()) as { ok?: boolean; parents?: ParentHit[] }
      const found = res.ok && data.ok ? (data.parents ?? []) : []
      setHits(found)
      setSelected(found[0]?.id ?? null)
      if (!found.length) setError('Никого не нашли — попробуйте часть имени или email.')
    } catch {
      setError('Поиск не удался — попробуйте ещё раз.')
    }
    setBusy(false)
  }

  const assign = async () => {
    if (selected == null) return
    setBusy(true)
    setError('')
    const res = await fetch('/coach/child-requests/assign', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ requestId: request.id, parentId: selected }),
    })
    if (res.ok) {
      router.refresh()
    } else {
      const data = (await res.json().catch(() => null)) as { error?: string } | null
      setError(data?.error ?? 'Не удалось отправить — попробуйте ещё раз.')
      setBusy(false)
    }
  }

  const decide = async (action: 'reject' | 'reopen') => {
    if (action === 'reject' && !window.confirm(`Отклонить заявку ребёнка «${request.childName}»?`)) return
    setBusy(true)
    setError('')
    const res = await fetch('/coach/requests/decide', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kind: 'child', id: request.id, action }),
    })
    if (res.ok) router.refresh()
    else {
      setError('Не удалось сохранить — попробуйте ещё раз.')
      setBusy(false)
    }
  }

  return (
    <article className="card stack-sm">
      <strong>{request.childName}</strong>
      <span className="muted small">
        Дата рождения: {new Date(request.dateOfBirth).toLocaleDateString('ru-RU')} · Указанный родитель:{' '}
        {request.parentName}
      </span>

      {request.status === 'parent_review' ? (
        <>
          <span className="small">
            Передана родителю: <strong>{request.proposedParentName ?? '—'}</strong> — ждём подтверждения.
          </span>
          <div className="row" style={{ gap: '0.5rem', flexWrap: 'wrap' }}>
            <button type="button" className="btn" disabled={busy} onClick={() => decide('reopen')}>
              Вернуть на проверку
            </button>
            <button type="button" className="btn" disabled={busy} onClick={() => decide('reject')}>
              Отклонить
            </button>
          </div>
        </>
      ) : (
        <>
          <div className="row" style={{ gap: '0.5rem' }}>
            <input
              className="input"
              placeholder="Имя или email родителя"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  void search()
                }
              }}
            />
            <button type="button" className="btn" disabled={busy || q.trim().length < 2} onClick={search}>
              Найти
            </button>
          </div>
          {hits.length > 0 && (
            <select className="select" value={selected ?? ''} onChange={(e) => setSelected(Number(e.target.value))}>
              {hits.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                  {p.branch ? ` · ${p.branch}` : ' · без филиала'}
                </option>
              ))}
            </select>
          )}
          <div className="row" style={{ gap: '0.5rem', flexWrap: 'wrap' }}>
            <button type="button" className="btn btn-primary" disabled={busy || selected == null} onClick={assign}>
              Отправить родителю
            </button>
            <button type="button" className="btn" disabled={busy} onClick={() => decide('reject')}>
              Отклонить
            </button>
          </div>
        </>
      )}
      {error && <span className="muted small">{error}</span>}
    </article>
  )
}
