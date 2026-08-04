'use client'

import React, { useState } from 'react'

export const PlayerGroupList = ({ players, groups }: { players: { id: number; name: string; groupId: number | null }[]; groups: { id: number; name: string }[] }) => {
  const [rows, setRows] = useState(players)
  const [busy, setBusy] = useState<number | null>(null)
  return <div className="stack-sm">{rows.map((player) => <label key={player.id} className="card row-between"><strong>{player.name}</strong><select className="input" style={{ width: 'auto' }} value={player.groupId ?? ''} disabled={busy === player.id} onChange={async (event) => {
    const groupId = Number(event.target.value)
    setBusy(player.id)
    const res = await fetch('/coach/player-group', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ playerId: player.id, groupId }) })
    if (res.ok) setRows((current) => current.map((row) => row.id === player.id ? { ...row, groupId } : row))
    setBusy(null)
  }}><option value="" disabled>Выберите группу</option>{groups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}</select></label>)}</div>
}
