'use client'

import { useEffect, useState } from 'react'

/**
 * Промпт установки PWA «на экран» (веха PR3). Клиентский, рендерит баннер.
 *
 * Android/desktop Chrome: ловим `beforeinstallprompt` (preventDefault, отложить),
 * по кнопке вызываем нативный `prompt()`. iOS Safari это событие НЕ шлёт — для него
 * показываем текстовую подсказку «Поделиться → На экран „Домой“».
 *
 * Не навязываемся: если уже установлено (standalone) — молчим; «Позже» прячет баннер
 * на 14 дней (метка в localStorage). Установка существенна для адопшена (пуш о смене
 * тренировки доходит до иконки на экране, а не теряется во вкладках).
 */

// beforeinstallprompt ещё не в стандартном lib.dom — минимальный локальный тип.
interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[]
  prompt: () => Promise<void>
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
}

const DISMISS_KEY = 'pwa-install-dismissed-at'
const DISMISS_DAYS = 14

function dismissedRecently(): boolean {
  try {
    const at = window.localStorage.getItem(DISMISS_KEY)
    if (!at) return false
    const ageMs = Date.now() - Number(at)
    return ageMs < DISMISS_DAYS * 24 * 60 * 60 * 1000
  } catch {
    return false
  }
}

function isStandalone(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    // iOS Safari выставляет navigator.standalone в standalone-режиме.
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  )
}

function isIos(): boolean {
  return (
    /iphone|ipad|ipod/i.test(window.navigator.userAgent) &&
    // исключаем in-app webview-браузеры, где «на экран» недоступно
    !/crios|fxios/i.test(window.navigator.userAgent)
  )
}

export function InstallPrompt() {
  const [mode, setMode] = useState<'prompt' | 'ios' | null>(null)
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null)

  useEffect(() => {
    if (isStandalone() || dismissedRecently()) return

    const onBeforeInstall = (e: Event) => {
      e.preventDefault()
      setDeferred(e as BeforeInstallPromptEvent)
      setMode('prompt')
    }
    const onInstalled = () => {
      setMode(null)
      setDeferred(null)
    }

    window.addEventListener('beforeinstallprompt', onBeforeInstall)
    window.addEventListener('appinstalled', onInstalled)

    // iOS не шлёт beforeinstallprompt — показываем подсказку напрямую.
    if (isIos()) setMode('ios')

    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  if (!mode) return null

  const close = () => {
    try {
      window.localStorage.setItem(DISMISS_KEY, String(Date.now()))
    } catch {
      /* приватный режим без localStorage — просто прячем на эту сессию */
    }
    setMode(null)
  }

  const install = async () => {
    if (!deferred) return
    await deferred.prompt()
    await deferred.userChoice
    setMode(null)
    setDeferred(null)
  }

  return (
    <div
      role="dialog"
      aria-label="Установить приложение"
      style={{
        position: 'fixed',
        left: '50%',
        bottom: 'max(1rem, env(safe-area-inset-bottom))',
        transform: 'translateX(-50%)',
        width: 'min(92vw, 420px)',
        background: '#11261c',
        border: '1px solid #1f3a2c',
        borderRadius: 12,
        padding: '0.9rem 1rem',
        boxShadow: '0 8px 30px rgba(0, 0, 0, 0.45)',
        zIndex: 50,
        display: 'flex',
        gap: '0.75rem',
        alignItems: 'flex-start',
      }}
    >
      <span aria-hidden style={{ fontSize: '1.5rem', lineHeight: 1 }}>
        ⚽
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <strong style={{ display: 'block', marginBottom: '0.2rem' }}>Установить приложение</strong>
        {mode === 'ios' ? (
          <p style={{ margin: 0, color: 'var(--muted)', fontSize: '0.9rem' }}>
            Нажмите «Поделиться» в Safari, затем «На экран „Домой“» — чтобы получать уведомления о
            тренировках.
          </p>
        ) : (
          <>
            <p style={{ margin: '0 0 0.6rem', color: 'var(--muted)', fontSize: '0.9rem' }}>
              На экран телефона — чтобы не пропускать изменения в расписании.
            </p>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                type="button"
                onClick={install}
                style={{
                  padding: '0.45rem 0.9rem',
                  borderRadius: 8,
                  border: 'none',
                  background: 'var(--accent)',
                  color: '#0b1f17',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Установить
              </button>
              <button
                type="button"
                onClick={close}
                style={{
                  padding: '0.45rem 0.9rem',
                  borderRadius: 8,
                  border: '1px solid #2a4636',
                  background: 'transparent',
                  color: 'var(--fg)',
                  cursor: 'pointer',
                }}
              >
                Позже
              </button>
            </div>
          </>
        )}
      </div>
      <button
        type="button"
        onClick={close}
        aria-label="Закрыть"
        style={{
          background: 'transparent',
          border: 'none',
          color: 'var(--muted)',
          fontSize: '1.1rem',
          lineHeight: 1,
          cursor: 'pointer',
          padding: '0.1rem 0.2rem',
        }}
      >
        ✕
      </button>
    </div>
  )
}
