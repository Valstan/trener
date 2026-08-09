'use client'

import { useRouter } from 'next/navigation'
import React, { useState } from 'react'

// «Записать оплату» прямо в нити диалога — главный UX-разрыв денежного контура:
// бухгалтер читает «я оплатил 2500 вчера», видит статус ребёнка тут же, а чтобы
// отметить оплату — уходил на /coach/payments и искал ребёнка в общем списке.
export const QuickPayment = ({
  players,
}: {
  players: { id: number; name: string; fee: number | null }[]
}) => {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [playerId, setPlayerId] = useState(players[0]?.id ?? -1)
  const [paidUntil, setPaidUntil] = useState('')
  const [amount, setAmount] = useState(() => (players[0]?.fee != null ? String(players[0].fee) : ''))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState('')

  if (!players.length) return null

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!paidUntil) {
      setError('Укажите дату «оплачено по».')
      return
    }
    setBusy(true)
    setError('')
    try {
      const res = await fetch('/coach/payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerId, paidUntil, amount: amount ? Number(amount) : undefined }),
      })
      const data = (await res.json()) as { ok?: boolean; error?: string }
      if (res.ok && data.ok) {
        const name = players.find((c) => c.id === playerId)?.name ?? 'ребёнок'
        setDone(`${name} — оплачено по ${new Date(paidUntil).toLocaleDateString('ru-RU')}`)
        setPaidUntil('')
        router.refresh()
      } else {
        setError(data.error ?? 'Не удалось сохранить. Попробуйте ещё раз.')
      }
    } catch {
      setError('Не удалось сохранить. Попробуйте ещё раз.')
    }
    setBusy(false)
  }

  if (!open) {
    return (
      <button type="button" className="btn" style={{ justifySelf: 'start' }} onClick={() => setOpen(true)}>
        💳 Записать оплату
      </button>
    )
  }

  return (
    <form onSubmit={submit} className="card stack-sm">
      <strong className="small">Записать оплату</strong>
      <select className="select" value={playerId} onChange={(e) => {
        const id = Number(e.target.value)
        setPlayerId(id)
        const fee = players.find((c) => c.id === id)?.fee
        setAmount(fee != null ? String(fee) : '')
      }}>
        {players.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>
      <label className="field">
        <span>Оплачено по</span>
        <input className="input" type="date" value={paidUntil} onChange={(e) => setPaidUntil(e.target.value)} />
      </label>
      <label className="field">
        <span>Сумма, ₽</span>
        <input className="input" type="number" min={0} value={amount} onChange={(e) => setAmount(e.target.value)} />
      </label>
      <div className="row" style={{ gap: '0.5rem' }}>
        <button type="submit" className="btn btn-primary" disabled={busy}>
          {busy ? 'Сохраняем…' : 'Записать'}
        </button>
        <button type="button" className="btn" onClick={() => setOpen(false)}>
          Свернуть
        </button>
      </div>
      {done && <span className="success-text">✓ Записано: {done}</span>}
      {error && <span className="error-text">{error}</span>}
    </form>
  )
}
