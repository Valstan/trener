'use client'

import React, { useCallback, useEffect, useState } from 'react'

import { isIos, isPushSupported, isStandalone } from '@/lib/pwa'

// VAPID applicationServerKey ждёт Uint8Array из base64url-строки.
const urlBase64ToUint8Array = (base64: string): Uint8Array => {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4)
  const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(b64)
  const arr = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i)
  return arr
}

type State = 'checking' | 'unsupported' | 'ios-needs-install' | 'ready' | 'subscribed' | 'denied' | 'busy'

const VAPID_PUBLIC = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY

// Подписка на web-push по жесту пользователя (требование браузеров). iOS-гард: пуш
// доступен только в УСТАНОВЛЕННОМ PWA (16.4+) — иначе подсказываем установить.
// Корректность от пуша НЕ зависит (in-app очередь первична) — это апгрейд доставки.
export const PushSubscribe = () => {
  const [state, setState] = useState<State>('checking')

  useEffect(() => {
    if (!isPushSupported() || !VAPID_PUBLIC) return setState('unsupported')
    if (isIos() && !isStandalone()) return setState('ios-needs-install')
    if (Notification.permission === 'denied') return setState('denied')
    let cancelled = false
    navigator.serviceWorker
      .getRegistration()
      .then(async (reg) => {
        if (cancelled) return
        if (!reg) return setState('unsupported') // SW не зарегистрирован (напр. dev)
        const sub = await reg.pushManager.getSubscription()
        setState(sub ? 'subscribed' : 'ready')
      })
      .catch(() => !cancelled && setState('unsupported'))
    return () => {
      cancelled = true
    }
  }, [])

  const subscribe = useCallback(async () => {
    if (!VAPID_PUBLIC) return
    setState('busy')
    try {
      const permission = await Notification.requestPermission()
      if (permission !== 'granted') return setState('denied')
      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC),
      })
      const res = await fetch('/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscription: sub.toJSON(), platform: navigator.platform }),
      })
      setState(res.ok ? 'subscribed' : 'ready')
    } catch {
      setState('ready')
    }
  }, [])

  if (state === 'checking' || state === 'unsupported') return null

  if (state === 'subscribed') {
    return (
      <div className="card stack-sm">
        <span className="success-text">🔔 Уведомления включены</span>
      </div>
    )
  }

  if (state === 'ios-needs-install') {
    return (
      <div className="card stack-sm">
        <strong>Включите уведомления</strong>
        <span className="muted small">
          На iPhone сначала добавьте приложение на экран «Домой» (кнопка «Поделиться» → «На экран
          „Домой“»), затем откройте его и включите уведомления.
        </span>
      </div>
    )
  }

  if (state === 'denied') {
    return (
      <div className="card stack-sm">
        <strong>Уведомления отключены</strong>
        <span className="muted small">
          Разрешите уведомления в настройках браузера, чтобы узнавать об изменениях быстрее. Даже без
          них изменения видны здесь, в приложении.
        </span>
      </div>
    )
  }

  // ready
  return (
    <div className="card card-accent stack-sm">
      <strong>Уведомления об изменениях</strong>
      <span className="muted small">
        Включите пуш, чтобы узнавать о переносах и отменах сразу. Это ускорение — изменения в любом
        случае видны в приложении.
      </span>
      <button
        type="button"
        onClick={subscribe}
        disabled={state === 'busy'}
        className="btn btn-primary btn-sm"
        style={{ justifySelf: 'start' }}
      >
        {state === 'busy' ? 'Включаю…' : 'Включить уведомления'}
      </button>
    </div>
  )
}
