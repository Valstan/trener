// PWA/push-возможности окружения. Чистые проверки, зовутся ТОЛЬКО на клиенте
// (используют window/navigator). Вынесены из InstallPrompt для переиспользования в
// PushSubscribe (DRY).

export const isStandalone = (): boolean =>
  window.matchMedia('(display-mode: standalone)').matches ||
  // iOS Safari выставляет navigator.standalone в standalone-режиме.
  (window.navigator as Navigator & { standalone?: boolean }).standalone === true

export const isIos = (): boolean =>
  /iphone|ipad|ipod/i.test(window.navigator.userAgent) &&
  // исключаем in-app webview-браузеры
  !/crios|fxios/i.test(window.navigator.userAgent)

// Браузер умеет web-push (service worker + PushManager + Notification API).
export const isPushSupported = (): boolean =>
  typeof window !== 'undefined' &&
  'serviceWorker' in navigator &&
  'PushManager' in window &&
  'Notification' in window
