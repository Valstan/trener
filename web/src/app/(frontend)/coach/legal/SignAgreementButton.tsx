'use client'

import { useRouter } from 'next/navigation'
import React, { useState } from 'react'

// Подписание договора поручения уполномоченным представителем школы. Чекбокс не
// предзаполнен (осознанный акт, как у согласия родителя); сервер пишет журнальную
// запись с hash версии и снапшотом реквизитов.
export const SignAgreementButton = ({ branchId }: { branchId: number }) => {
  const router = useRouter()
  const [agreed, setAgreed] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const sign = async () => {
    setBusy(true)
    setError('')
    try {
      const res = await fetch('/coach/legal/sign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ branchId }),
      })
      const data = (await res.json().catch(() => null)) as { error?: string } | null
      if (res.ok) {
        router.refresh()
        return
      }
      setError(data?.error ?? 'Не удалось подписать — попробуйте ещё раз.')
    } catch {
      setError('Не удалось подписать — попробуйте ещё раз.')
    }
    setBusy(false)
  }

  return (
    <div className="card card-accent stack-sm">
      <label className="check-row">
        <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />
        <span>
          Я — уполномоченный представитель школы, ознакомлен(а) с текстом договора выше и
          подписываю его от имени школы.
        </span>
      </label>
      <button
        type="button"
        className="btn btn-primary"
        style={{ justifySelf: 'start' }}
        disabled={!agreed || busy}
        onClick={sign}
      >
        {busy ? 'Подписываем…' : 'Подписать договор'}
      </button>
      {error && <p className="error-text" style={{ margin: 0 }}>{error}</p>}
    </div>
  )
}
