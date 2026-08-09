'use client'

import React, { useMemo, useState } from 'react'

// Дети и группы: перевод ребёнка селектом (PATCH сразу). Доводка 09.08:
//   • поиск по имени и фильтр «без группы» — при сотнях детей лента была нечитаема,
//     а ребёнок без группы (самый срочный случай) не находился вовсе;
//   • ошибки PATCH показываются (раньше проглатывались молча — селект «сработал»,
//     а перевод нет).
export const PlayerGroupList = ({
  players,
  groups,
}: {
  players: { id: number; name: string; groupId: number | null }[]
  groups: { id: number; name: string }[]
}) => {
  const [rows, setRows] = useState(players)
  const [busy, setBusy] = useState<number | null>(null)
  const [error, setError] = useState<number | null>(null)
  const [q, setQ] = useState('')
  const [onlyUngrouped, setOnlyUngrouped] = useState(false)

  const visible = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return rows.filter(
      (p) => (!onlyUngrouped || p.groupId == null) && (!needle || p.name.toLowerCase().includes(needle)),
    )
  }, [rows, q, onlyUngrouped])

  const ungroupedCount = rows.filter((p) => p.groupId == null).length

  return (
    <div className="stack-sm">
      <div className="row" style={{ gap: '0.5rem', flexWrap: 'wrap' }}>
        <input
          className="input"
          style={{ flex: '1 1 160px' }}
          placeholder="Поиск по имени"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <button
          type="button"
          className={onlyUngrouped ? 'btn btn-primary' : 'btn'}
          onClick={() => setOnlyUngrouped((v) => !v)}
        >
          Без группы{ungroupedCount ? ` (${ungroupedCount})` : ''}
        </button>
      </div>
      {visible.length === 0 && <p className="muted">Никого не нашли.</p>}
      {visible.map((player) => (
        <div key={player.id} className="stack-sm" style={{ gap: '0.25rem' }}>
          <label className="card row-between">
            <strong>{player.name}</strong>
            <select
              className="input"
              style={{ width: 'auto' }}
              value={player.groupId ?? ''}
              disabled={busy === player.id}
              onChange={async (event) => {
                const groupId = Number(event.target.value)
                setBusy(player.id)
                setError(null)
                try {
                  const res = await fetch('/coach/player-group', {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ playerId: player.id, groupId }),
                  })
                  if (res.ok) setRows((current) => current.map((row) => (row.id === player.id ? { ...row, groupId } : row)))
                  else setError(player.id)
                } catch {
                  setError(player.id)
                }
                setBusy(null)
              }}
            >
              <option value="" disabled>
                Выберите группу
              </option>
              {groups.map((group) => (
                <option key={group.id} value={group.id}>
                  {group.name}
                </option>
              ))}
            </select>
          </label>
          {error === player.id && (
            <span className="muted small">Не удалось перевести — попробуйте ещё раз.</span>
          )}
        </div>
      ))}
    </div>
  )
}
