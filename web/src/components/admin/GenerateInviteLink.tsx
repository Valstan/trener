'use client'

import React, { useState } from 'react'
import { useDocumentInfo } from '@payloadcms/ui'

// Sidebar-виджет на странице правки ребёнка (Players): тренер/админ генерит
// ссылку-приглашение для родителя и копирует её. Дёргает staff-only POST /auth/invite
// (он же проверяет, что ребёнок — в группе этого тренера, скоупинг #015).
//
// Для несохранённого ребёнка (нет id) показываем подсказку сохранить — токен
// привязан к конкретному player.
const GenerateInviteLink: React.FC = () => {
  const { id } = useDocumentInfo()
  const hasId = id !== undefined && id !== null && id !== ''

  const [link, setLink] = useState('')
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState('')

  const generate = async () => {
    if (!hasId) return
    setLoading(true)
    setError('')
    setCopied(false)
    try {
      const res = await fetch('/auth/invite', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerId: id }),
      })
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; joinUrl?: string }
      if (res.ok && data.ok && data.joinUrl) {
        setLink(data.joinUrl)
      } else if (res.status === 403) {
        setError('Нет доступа: этот ребёнок не в вашей группе.')
      } else {
        setError('Не удалось создать ссылку. Попробуйте ещё раз.')
      }
    } catch {
      setError('Не удалось создать ссылку. Попробуйте ещё раз.')
    }
    setLoading(false)
  }

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link)
      setCopied(true)
    } catch {
      setCopied(false)
    }
  }

  if (!hasId) {
    return (
      <div style={{ marginTop: '0.5rem' }}>
        <h4 style={{ margin: '0 0 0.25rem' }}>Приглашение родителю</h4>
        <p style={{ color: 'var(--theme-elevation-500)', fontSize: '0.85rem' }}>
          Сохраните ребёнка, чтобы создать ссылку-приглашение.
        </p>
      </div>
    )
  }

  return (
    <div style={{ marginTop: '0.5rem' }}>
      <h4 style={{ margin: '0 0 0.25rem' }}>Приглашение родителю</h4>
      <p style={{ color: 'var(--theme-elevation-500)', fontSize: '0.85rem', marginTop: 0 }}>
        Создайте ссылку и передайте родителю — он привяжет свой аккаунт к ребёнку.
      </p>

      <button
        type="button"
        onClick={generate}
        disabled={loading}
        className="btn btn--style-secondary btn--size-small"
      >
        {loading ? 'Создаём…' : link ? 'Создать новую ссылку' : 'Создать ссылку-приглашение'}
      </button>

      {link ? (
        <div style={{ marginTop: '0.5rem', display: 'grid', gap: '0.4rem' }}>
          <input
            type="text"
            readOnly
            value={link}
            onFocus={(e) => e.currentTarget.select()}
            style={{
              width: '100%',
              padding: '0.4rem 0.5rem',
              fontSize: '0.8rem',
              borderRadius: 6,
              border: '1px solid var(--theme-elevation-150)',
            }}
          />
          <button
            type="button"
            onClick={copy}
            className="btn btn--style-secondary btn--size-small"
            style={{ justifySelf: 'start' }}
          >
            {copied ? 'Скопировано ✓' : 'Скопировать'}
          </button>
        </div>
      ) : null}

      {error ? <p style={{ color: 'var(--theme-error-500)', fontSize: '0.85rem' }}>{error}</p> : null}
    </div>
  )
}

export default GenerateInviteLink
