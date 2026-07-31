'use client'

import React, { useEffect, useState } from 'react'

type Theme = 'system' | 'light' | 'dark'

const themes: Theme[] = ['system', 'light', 'dark']
const labels: Record<Theme, string> = {
  system: 'Системная тема',
  light: 'Светлая тема',
  dark: 'Тёмная тема',
}
const icons: Record<Theme, string> = { system: '◐', light: '☀', dark: '☾' }

const applyTheme = (theme: Theme): void => {
  if (theme === 'system') document.documentElement.removeAttribute('data-theme')
  else document.documentElement.dataset.theme = theme
  const dark =
    theme === 'dark' || (theme === 'system' && matchMedia('(prefers-color-scheme: dark)').matches)
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute('content', dark ? '#0a1813' : '#f5f7f2')
}

export const ThemeToggle = () => {
  const [theme, setTheme] = useState<Theme>('system')

  useEffect(() => {
    const saved = localStorage.getItem('trener-theme')
    const initial = themes.includes(saved as Theme) ? (saved as Theme) : 'system'
    setTheme(initial)
    applyTheme(initial)
  }, [])

  const cycle = () => {
    const next = themes[(themes.indexOf(theme) + 1) % themes.length]
    localStorage.setItem('trener-theme', next)
    setTheme(next)
    applyTheme(next)
  }

  return (
    <button
      type="button"
      className="theme-toggle"
      onClick={cycle}
      aria-label={`${labels[theme]}. Переключить`}
    >
      {icons[theme]}
    </button>
  )
}
