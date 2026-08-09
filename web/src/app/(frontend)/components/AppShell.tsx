import Link from 'next/link'
import React from 'react'

import { PushSubscribe } from './PushSubscribe'
import { ThemeToggle } from './ThemeToggle'

// Оболочка экрана за логином: липкая шапка + контент + нижние табы (нативный
// мобильный паттерн). Активный таб подсвечивается через aria-current — страница
// знает свой маршрут и передаёт `active`, поэтому клиентский роутер не нужен.

export type Tab = { key: string; href: string; label: string; icon: string; items?: Tab[] }

// Наборы вкладок по ролям. Иконки — эмодзи в тон остальному приложению.
//
// «Оплата» — таб, а не только карточка на /home: до аудита 30.07 раздел достигался
// ИСКЛЮЧИТЕЛЬНО через неподписанный ⚽ в шапке, то есть родитель с вопросом «сколько
// платить» его не находил.
//
// Шесть табов на 375px — по ~62px на таб (`.tab-bar a` — flex 1 1 0, шрифт 0.7rem).
// Поэтому ярлыки короче заголовков экранов: «Новости» вместо «Объявления», «Матчи»
// вместо «Результаты». Заголовки внутри экранов остались прежними — в узкой полосе
// важнее попасть пальцем, чем повторить заголовок дословно.
export const COACH_TABS: Tab[] = [
  { key: 'schedule', href: '/coach/schedule', label: 'Расписание', icon: '📅' },
  { key: 'chat', href: '/chat', label: 'Чат', icon: '👥' },
  { key: 'questions', href: '/coach/questions', label: 'Вопросы', icon: '💬' },
  {
    key: 'more',
    href: '#more',
    label: 'Ещё',
    icon: '•••',
    items: [
      { key: 'announcements', href: '/coach/announcements', label: 'Новости', icon: '📣' },
      { key: 'matches', href: '/coach/matches', label: 'Матчи', icon: '🏆' },
      { key: 'import', href: '/coach/import', label: 'Импорт детей', icon: '📥' },
    ],
  },
]

export const PARENT_TABS: Tab[] = [
  { key: 'changes', href: '/parent', label: 'Изменения', icon: '🔔' },
  // «Расписание» — таб первого ряда (главный вопрос родителя — «когда тренировка»);
  // «Новости» ушли в «Ещё», чтобы удержать шесть позиций на 375px.
  { key: 'schedule', href: '/parent/schedule', label: 'Расписание', icon: '📅' },
  { key: 'chat', href: '/chat', label: 'Чат', icon: '👥' },
  { key: 'payments', href: '/parent/payments', label: 'Оплата', icon: '💳' },
  {
    key: 'more',
    href: '#more',
    label: 'Ещё',
    icon: '•••',
    items: [
      { key: 'announcements', href: '/parent/announcements', label: 'Новости', icon: '📣' },
      { key: 'matches', href: '/parent/matches', label: 'Матчи', icon: '🏆' },
      { key: 'ask', href: '/parent/ask', label: 'Вопрос тренеру', icon: '💬' },
    ],
  },
]

export const CHILD_TABS: Tab[] = [
  { key: 'home', href: '/child', label: 'Главная', icon: '⚽' },
  { key: 'chat', href: '/chat', label: 'Детский чат', icon: '👥' },
  { key: 'account', href: '/account', label: 'Аккаунт', icon: '👤' },
]

// Наборы табов персонала помечаем в WeakSet, а не сравниваем со ссылкой на
// COACH_TABS: переключатель «Приложение / Администрация» раньше держался на
// `tabs === COACH_TABS`, и любой экран со СВОИМ массивом молча его терял.
const staffTabSets = new WeakSet<Tab[]>()
staffTabSets.add(COACH_TABS)

export const isStaffTabs = (tabs?: Tab[]): boolean => Boolean(tabs && staffTabSets.has(tabs))

// Табы персонала с учётом роли: владельцу и админу филиала — «Оплата» и «Заявки»
// в «Ещё» (ключ 'payments' экраны передавали всегда, но самого таба не было —
// раздел учёта достигался только карточкой на /home, куда владелец не заходит,
// т.к. его домашний экран — /admin). Тренеру их не показываем: экраны его всё
// равно редиректят, а мёртвый пункт в навигации хуже отсутствующего.
export const staffTabs = (user: { roles?: string[] | null } | null | undefined): Tab[] => {
  const roles = Array.isArray(user?.roles) ? user!.roles! : []
  const manager = roles.includes('owner') || roles.includes('admin')
  if (!manager) return COACH_TABS
  const more = COACH_TABS.find((t) => t.key === 'more')
  const tabs: Tab[] = COACH_TABS.map((t) =>
    t.key === 'more'
      ? {
          ...t,
          items: [
            { key: 'payments', href: '/coach/payments', label: 'Оплата', icon: '💳' },
            { key: 'requests', href: '/coach/requests', label: 'Заявки', icon: '📨' },
            ...(more?.items ?? []),
          ],
        }
      : t,
  )
  staffTabSets.add(tabs)
  return tabs
}

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
      {isStaffTabs(tabs) && (
        <nav className="mode-switch" aria-label="Режим работы">
          <span aria-current="page">Приложение</span>
          <Link href="/admin">Администрация</Link>
        </nav>
      )}
      <ThemeToggle />
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

    <main className={tabs ? 'page has-tabbar' : 'page'}>
      {/* Призыв включить пуш — для ВСЕХ залогиненных ролей (до 09.08 подписку
          предлагали только родителю: пуши тренеру/владельцу/ребёнку уходили в
          пустоту — некому было выдать разрешение). Тихий вариант: после подписки
          или отказа ничего не рисует; полный статус — на экране «Аккаунт». */}
      {tabs && <PushSubscribe variant="prompt" />}
      {children}
    </main>

    {tabs && (
      <nav className="tab-bar" aria-label="Разделы">
        {tabs.map((t) => {
          if (t.items) {
            const moreActive = t.items.some((item) => item.key === active)
            return (
              <details key={t.key} className="tab-more">
                <summary aria-current={moreActive ? 'page' : undefined}>
                  <span className="ic" aria-hidden>
                    {t.icon}
                  </span>
                  {t.label}
                </summary>
                <div className="tab-more-menu">
                  <strong className="small">Другие разделы</strong>
                  {t.items.map((item) => (
                    <Link
                      key={item.key}
                      href={item.href}
                      aria-current={item.key === active ? 'page' : undefined}
                    >
                      <span className="ic" aria-hidden>
                        {item.icon}
                      </span>
                      <span>{item.label}</span>
                      <span className="tab-more-arrow" aria-hidden>
                        ›
                      </span>
                    </Link>
                  ))}
                </div>
              </details>
            )
          }
          return (
            <Link key={t.key} href={t.href} aria-current={t.key === active ? 'page' : undefined}>
              <span className="ic" aria-hidden>
                {t.icon}
              </span>
              {t.label}
            </Link>
          )
        })}
      </nav>
    )}
  </>
)
