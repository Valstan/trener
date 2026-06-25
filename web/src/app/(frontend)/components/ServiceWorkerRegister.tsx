'use client'

import { useEffect } from 'react'

/**
 * Регистрация service worker (PWA, веха PR3). Клиентский, рендерит null.
 * Регистрируем только в production: в dev SW кэширует промежуточные HMR-ответы
 * и мешает разработке. Ждём события load, чтобы не конкурировать за сеть со стартом.
 */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') return
    if (!('serviceWorker' in navigator)) return

    const register = () => {
      navigator.serviceWorker.register('/sw.js').catch(() => {
        /* регистрация не критична — сайт работает и без офлайна */
      })
    }

    if (document.readyState === 'complete') {
      register()
    } else {
      window.addEventListener('load', register, { once: true })
      return () => window.removeEventListener('load', register)
    }
  }, [])

  return null
}
