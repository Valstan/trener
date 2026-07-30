import Link from 'next/link'
import React from 'react'

// Оболочка экрана за логином: липкая шапка + контент + нижние табы (нативный
// мобильный паттерн). Активный таб подсвечивается через aria-current — страница
// знает свой маршрут и передаёт `active`, поэтому клиентский роутер не нужен.

export type Tab = { key: string; href: string; label: string; icon: string }

// Наборы вкладок по ролям. Иконки — эмодзи в тон остальному приложению.
//
// «Оплата» — таб, а не только карточка на /home: до аудита 30.07 раздел достигался
// ИСКЛЮЧИТЕЛЬНО через неподписанный ⚽ в шапке, то есть родитель с вопросом «сколько
// платить» его не находил. Пять табов на 375px помещаются (`.tab-bar a` — flex 1 1 0,
// шрифт 0.7rem), самый длинный ярлык «Объявления» ≈ 56px при доступных ~67px.
export const COACH_TABS: Tab[] = [
  { key: 'schedule', href: '/coach/schedule', label: 'Расписание', icon: '📅' },
  { key: 'announcements', href: '/coach/announcements', label: 'Объявления', icon: '📣' },
  { key: 'matches', href: '/coach/matches', label: 'Результаты', icon: '🏆' },
  { key: 'questions', href: '/coach/questions', label: 'Вопросы', icon: '💬' },
  { key: 'payments', href: '/coach/payments', label: 'Оплата', icon: '💳' },
]

export const PARENT_TABS: Tab[] = [
  { key: 'changes', href: '/parent', label: 'Изменения', icon: '🔔' },
  { key: 'announcements', href: '/parent/announcements', label: 'Объявления', icon: '📣' },
  { key: 'matches', href: '/parent/matches', label: 'Результаты', icon: '🏆' },
  { key: 'ask', href: '/parent/ask', label: 'Вопрос', icon: '💬' },
  { key: 'payments', href: '/parent/payments', label: 'Оплата', icon: '💳' },
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
        // ⚽ — вход на главную-карточки (M7): обзор всех разделов приложения.
        <Link href="/home" className="brand" aria-label="Главная">
          <span aria-hidden>⚽</span>
        </Link>
      )}
      {title && <span className="app-title">{title}</span>}
      <span className="spacer" />
      {tabs && (
        <Link
          href="/account"
          className="app-account"
          aria-label="Аккаунт"
          aria-current={active === 'account' ? 'page' : undefined}
        >
          <span aria-hidden>👤</span>
        </Link>
      )}
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
