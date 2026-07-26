'use client'

import React, { useState } from 'react'

// Кнопка «Скопировать реквизиты» (M8): родитель переносит их в своё банковское
// приложение. Clipboard API; фолбэк — текст и так виден на экране, можно выделить.
export const CopyDetails = ({ text }: { text: string }) => {
  const [copied, setCopied] = useState(false)

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard недоступен (http/старый браузер) — реквизиты видны текстом выше.
    }
  }

  return (
    <button type="button" className="btn" onClick={copy}>
      {copied ? '✓ Скопировано' : '📋 Скопировать реквизиты'}
    </button>
  )
}
