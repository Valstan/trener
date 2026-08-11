'use client'

import { usePathname } from 'next/navigation'
import React, { useEffect, useState } from 'react'

import { type VisualStyle, visualStyleFromStorage, zoneForPath } from './appearance'

type Theme = 'system' | 'light' | 'dark'

const themes: Theme[] = ['system', 'light', 'dark']
const labels: Record<Theme, string> = {
  system: 'Системная тема',
  light: 'Светлая тема',
  dark: 'Тёмная тема',
}
const icons: Record<Theme, string> = { system: '◐', light: '☀', dark: '☾' }

const darkForTheme = (theme: Theme): boolean =>
  theme === 'dark' || (theme === 'system' && matchMedia('(prefers-color-scheme: dark)').matches)

const syncThemeColor = (theme: Theme): void => {
  const football = document.documentElement.dataset.style === 'football'
  const color = darkForTheme(theme)
    ? football
      ? '#071b13'
      : '#0a1813'
    : football
      ? '#d9f36a'
      : '#f5f7f2'
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', color)
}

const applyTheme = (theme: Theme): void => {
  if (theme === 'system') document.documentElement.removeAttribute('data-theme')
  else document.documentElement.dataset.theme = theme
  syncThemeColor(theme)
}

const ThemeToggle = () => {
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

export const AppearanceControls = () => {
  const pathname = usePathname()
  const [style, setStyle] = useState<VisualStyle>('classic')

  useEffect(() => {
    const initial = visualStyleFromStorage(localStorage.getItem('trener-style'))
    setStyle(initial)
    document.documentElement.dataset.style = initial
  }, [])

  useEffect(() => {
    document.documentElement.dataset.zone = zoneForPath(pathname)
  }, [pathname])

  const toggleStyle = () => {
    const next: VisualStyle = style === 'classic' ? 'football' : 'classic'
    localStorage.setItem('trener-style', next)
    document.documentElement.dataset.style = next
    const savedTheme = localStorage.getItem('trener-theme')
    syncThemeColor(themes.includes(savedTheme as Theme) ? (savedTheme as Theme) : 'system')
    setStyle(next)
  }

  return (
    <div className="appearance-controls" aria-label="Оформление приложения">
      <button
        type="button"
        className="style-toggle"
        onClick={toggleStyle}
        aria-pressed={style === 'football'}
        aria-label={
          style === 'football'
            ? 'Футбольный стиль. Переключить на классический'
            : 'Классический стиль. Переключить на футбольный'
        }
      >
        <span className="style-toggle-ball" aria-hidden>
          ⚽
        </span>
        <span className="appearance-label">{style === 'football' ? 'Футбол' : 'Классика'}</span>
      </button>
      <ThemeToggle />
    </div>
  )
}
