import Link from 'next/link'
import React from 'react'

// Оболочка экрана за логином: липкая шапка + контент + нижние табы (нативный
// мобильный паттерн). Активный таб подсвечивается через aria-current — страница
// знает свой маршрут и передаёт `active`, поэтому клиентский роутер не нужен.

export type Tab = { key: string; href: string; label: string; icon: string }

// Наборы вкладок по ролям. Иконки — эмодзи в тон остальному приложению.
export const COACH_TABS: Tab[] = [
  { key: 'schedule', href: '/coach/schedule', label: 'Расписание', icon: '📅' },
  { key: 'announcements', href: '/coach/announcements', label: 'Объявления', icon: '📣' },
  { key: 'questions', href: '/coach/questions', label: 'Вопросы', icon: '💬' },
]

export const PARENT_TABS: Tab[] = [
  { key: 'changes', href: '/parent', label: 'Изменения', icon: '🔔' },
  { key: 'announcements', href: '/parent/announcements', label: 'Объявления', icon: '📣' },
  { key: 'ask', href: '/parent/ask', label: 'Вопрос', icon: '💬' },
]

export const AppShell = ({
  title,
  back,
  tabs,
  active,
  children,
}: {
  title?: string
  back?: { href: string; label?: string }
  tabs?: Tab[]
  active?: string
  children: React.ReactNode
}) => (
  <>
    <header className="app-header">
      {back ? (
        <Link href={back.href} className="app-back" aria-label={back.label ?? 'Назад'}>
          ‹
        </Link>
      ) : (
        <span className="brand">
          <span aria-hidden>⚽</span>
        </span>
      )}
      {title && <span className="app-title">{title}</span>}
      <span className="spacer" />
    </header>

    <main className={tabs ? 'page has-tabbar' : 'page'}>{children}</main>

    {tabs && (
      <nav className="tab-bar" aria-label="Разделы">
        {tabs.map((t) => (
          <Link key={t.key} href={t.href} aria-current={t.key === active ? 'page' : undefined}>
            <span className="ic" aria-hidden>
              {t.icon}
            </span>
            {t.label}
          </Link>
        ))}
      </nav>
    )}
  </>
)
