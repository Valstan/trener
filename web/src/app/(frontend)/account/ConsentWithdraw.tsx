'use client'

import React, { useState } from 'react'

// Отзыв согласия 152-ФЗ из «Аккаунта» (D-016 §5). Последствия проговариваем до
// подтверждения: без согласия работа с данными ребёнка в приложении невозможна.
export const ConsentWithdraw = () => {
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')

  const withdraw = async () => {
    if (
      !window.confirm(
        'Отозвать согласие на обработку персональных данных? Школа прекратит обработку данных ребёнка, а приложение перестанет показывать его расписание и уведомления, пока согласие не будет дано снова.',
      )
    )
      return
    setBusy(true)
    setError('')
    try {
      const res = await fetch('/account/consent-withdraw', { method: 'POST' })
      if (res.ok) {
        setDone(true)
        window.location.href = '/parent'
        return
      }
      setError('Не удалось отозвать — попробуйте ещё раз или напишите школе.')
    } catch {
      setError('Не удалось отозвать — попробуйте ещё раз или напишите школе.')
    }
    setBusy(false)
  }

  if (done) return <p className="success-text">Согласие отозвано.</p>

  return (
    <div className="stack-sm">
      <p className="muted small" style={{ margin: 0 }}>
        Вы дали согласие на обработку данных ребёнка. Его можно отозвать в любой момент —
        факт отзыва фиксируется в журнале, школа получит уведомление.
      </p>
      <button type="button" className="btn" style={{ justifySelf: 'start' }} disabled={busy} onClick={withdraw}>
        {busy ? 'Отзываем…' : 'Отозвать согласие'}
      </button>
      {error && <span className="muted small">{error}</span>}
    </div>
  )
}
