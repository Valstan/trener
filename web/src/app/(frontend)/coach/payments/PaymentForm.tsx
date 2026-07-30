'use client'

import { useRouter } from 'next/navigation'
import React, { useState } from 'react'

// Форма записи оплаты (M8): ребёнок + «оплачено по» (+ с, сумма, заметка).
// Продление = новая запись; таблица ниже показывает актуальное состояние.
//
// Сумма подставляется из цены абонемента группы/филиала — администратор вбивает
// одно и то же число по сто раз в месяц, и это ровно та рутина, из-за которой
// таблицу ведут в тетрадке, а не в приложении.
export const PaymentForm = ({
  players,
}: {
  players: { id: number; name: string; fee: number | null }[]
}) => {
  const router = useRouter()
  const [playerId, setPlayerId] = useState<number>(players[0]?.id ?? -1)
  const [paidFrom, setPaidFrom] = useState('')
  const [paidUntil, setPaidUntil] = useState('')
  const [amount, setAmount] = useState(() => {
    const first = players[0]
    return first?.fee != null ? String(first.fee) : ''
  })
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

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
        body: JSON.stringify({
          playerId,
          paidUntil,
          paidFrom: paidFrom || undefined,
          amount: amount ? Number(amount) : undefined,
          note: note || undefined,
        }),
      })
      const data = (await res.json()) as { ok?: boolean }
      if (res.ok && data.ok) {
        setPaidFrom('')
        setPaidUntil('')
        setAmount(() => {
          const fee = players.find((p) => p.id === playerId)?.fee
          return fee != null ? String(fee) : ''
        })
        setNote('')
        setDone(true)
        router.refresh()
        setTimeout(() => setDone(false), 2500)
      } else {
        setError('Не удалось сохранить. Попробуйте ещё раз.')
      }
    } catch {
      setError('Не удалось сохранить. Попробуйте ещё раз.')
    }
    setBusy(false)
  }

  return (
    <form onSubmit={submit} className="stack-sm card">
      <div className="field">
        <label htmlFor="pay-player">Ребёнок</label>
        <select
          id="pay-player"
          className="select"
          value={playerId}
          onChange={(e) => {
            const id = Number(e.target.value)
            setPlayerId(id)
            // Смена ребёнка подставляет цену ЕГО группы, но не затирает сумму,
            // которую администратор уже поправил руками.
            const fee = players.find((p) => p.id === id)?.fee
            const prevFee = players.find((p) => p.id === playerId)?.fee
            if (amount === '' || amount === String(prevFee ?? '')) {
              setAmount(fee != null ? String(fee) : '')
            }
          }}
        >
          {players.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </div>
      <div className="field">
        <label htmlFor="pay-from">Оплачено с (необязательно)</label>
        <input id="pay-from" className="input" type="date" value={paidFrom} onChange={(e) => setPaidFrom(e.target.value)} />
      </div>
      <div className="field">
        <label htmlFor="pay-until">Оплачено по</label>
        <input id="pay-until" className="input" type="date" value={paidUntil} onChange={(e) => setPaidUntil(e.target.value)} />
      </div>
      <div className="field">
        <label htmlFor="pay-amount">Сумма, ₽ (необязательно)</label>
        <input
          id="pay-amount"
          className="input"
          type="number"
          min={0}
          placeholder="например, 2500"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
      </div>
      <input
        className="input"
        type="text"
        maxLength={200}
        placeholder="Заметка (необязательно)"
        value={note}
        onChange={(e) => setNote(e.target.value)}
      />
      <button type="submit" className="btn btn-primary" style={{ justifySelf: 'start' }} disabled={busy}>
        {busy ? 'Сохраняем…' : 'Записать оплату'}
      </button>
      {done && <span className="success-text">✓ Записано</span>}
      {error && <p className="error-text" style={{ margin: 0 }}>{error}</p>}
    </form>
  )
}
