'use client'

import Link from 'next/link'
import React, { useState } from 'react'

// Галка осознанного согласия (152-ФЗ §5.3 — отдельный акт, не предзаполнено) → POST.
// Сервер берёт parent/детей из сессии; здесь только подтверждение и версия политики.
export const ConsentForm = ({ policyVersion }: { policyVersion: string }) => {
  const [agreed, setAgreed] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!agreed) return
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/auth/consent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      const data = (await res.json()) as { ok?: boolean; redirect?: string }
      if (res.ok && data.ok) {
        window.location.href = data.redirect || '/'
        return
      }
      setError('Не удалось сохранить согласие. Попробуйте ещё раз.')
    } catch {
      setError('Не удалось сохранить согласие. Попробуйте ещё раз.')
    }
    setLoading(false)
  }

  return (
    <form onSubmit={onSubmit} className="stack" style={{ marginTop: '1.5rem' }}>
      <label className="check-row">
        <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />
        <span>
          Я подтверждаю, что являюсь законным представителем ребёнка, ознакомлен(а) с{' '}
          <Link href="/privacy" target="_blank">
            политикой обработки данных
          </Link>{' '}
          (редакция {policyVersion}) и даю согласие на обработку его персональных данных в указанных
          объёме и целях. Согласие можно отозвать в любой момент.
        </span>
      </label>
      <button
        type="submit"
        disabled={!agreed || loading}
        className="btn btn-primary"
        style={{ justifySelf: 'start' }}
      >
        {loading ? 'Сохраняем…' : 'Дать согласие и продолжить'}
      </button>
      {error && <p className="error-text">{error}</p>}
    </form>
  )
}
