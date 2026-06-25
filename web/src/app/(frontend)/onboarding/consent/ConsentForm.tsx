'use client'

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
    <form onSubmit={onSubmit} style={{ marginTop: '1.5rem', display: 'grid', gap: '1rem' }}>
      <label style={{ display: 'flex', gap: '0.6rem', alignItems: 'flex-start', cursor: 'pointer' }}>
        <input
          type="checkbox"
          checked={agreed}
          onChange={(e) => setAgreed(e.target.checked)}
          style={{ marginTop: '0.2rem' }}
        />
        <span>
          Я — законный представитель ребёнка и даю согласие на обработку его персональных данных в
          объёме, необходимом для участия в футбольной школе (редакция {policyVersion}).
        </span>
      </label>
      <button
        type="submit"
        disabled={!agreed || loading}
        style={{
          padding: '0.7rem 1.25rem',
          fontSize: '1rem',
          cursor: !agreed || loading ? 'default' : 'pointer',
          borderRadius: 8,
          border: 'none',
          background: !agreed ? '#9aa6a0' : '#0b1f17',
          color: '#fff',
          justifySelf: 'start',
        }}
      >
        {loading ? 'Сохраняем…' : 'Дать согласие и продолжить'}
      </button>
      {error && <p style={{ color: '#c0392b' }}>{error}</p>}
    </form>
  )
}
