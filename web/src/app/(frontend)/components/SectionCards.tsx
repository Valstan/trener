import Link from 'next/link'
import React from 'react'

// Карточки-разделы главной (M7, видение v2 §3). Единый источник для /home и
// /pending (там — те же плашки, но под замком). Будущие разделы v2 (оплата,
// галерея, чаты-комнаты) показываем серыми «скоро»: владелец видит каркас
// платформы, никто не ищет функцию вслепую.
export type Section = {
  key: string
  href: string
  icon: string
  title: string
  text: string
  soon?: boolean
}

const PARENT_SECTIONS: Section[] = [
  { key: 'changes', href: '/parent', icon: '🔔', title: 'Изменения', text: 'Переносы и отмены — подтвердите «Вижу»' },
  { key: 'announcements', href: '/parent/announcements', icon: '📣', title: 'Объявления', text: 'Новости школы и группы' },
  { key: 'matches', href: '/parent/matches', icon: '🏆', title: 'Результаты', text: 'Матчи и счёт' },
  { key: 'chat', href: '/chat', icon: '👥', title: 'Чат группы', text: 'Общий разговор тренеров и родителей' },
  { key: 'ask', href: '/parent/ask', icon: '💬', title: 'Вопрос тренеру', text: 'Личная переписка с тренером' },
  { key: 'account', href: '/account', icon: '👤', title: 'Аккаунт', text: 'Email, пароль, вход' },
  { key: 'payments', href: '/parent/payments', icon: '💳', title: 'Оплата', text: 'Абонемент: до когда оплачено и как платить' },
  { key: 'gallery', href: '#', icon: '📷', title: 'Фотогалерея', text: 'Фото и видео с матчей — скоро', soon: true },
]

const STAFF_SECTIONS: Section[] = [
  { key: 'schedule', href: '/coach/schedule', icon: '📅', title: 'Расписание', text: 'Тренировки, переносы, coverage' },
  { key: 'announcements', href: '/coach/announcements', icon: '📣', title: 'Объявления', text: 'Новости группе или всей сети' },
  { key: 'matches', href: '/coach/matches', icon: '🏆', title: 'Результаты', text: 'Матчи и составы' },
  { key: 'chat', href: '/chat', icon: '👥', title: 'Чат группы', text: 'Общий разговор тренеров и родителей' },
  { key: 'questions', href: '/coach/questions', icon: '💬', title: 'Вопросы', text: 'Переписка с родителями' },
  { key: 'account', href: '/account', icon: '👤', title: 'Аккаунт', text: 'Email, пароль, вход' },
  { key: 'gallery', href: '#', icon: '📷', title: 'Фотогалерея', text: 'Фото и видео с матчей — скоро', soon: true },
]

const PAYMENTS_SECTION: Section = {
  key: 'payments',
  href: '/coach/payments',
  icon: '💳',
  title: 'Оплата',
  text: 'Абонементы и платежи по детям',
}

// «Сотрудники» — только тем, кто вправе приглашать: владелец сети и админ филиала.
// Тренеру карточка не нужна и экран ему всё равно ответит редиректом.
const MANAGER_SECTION: Section = {
  key: 'staff',
  href: '/coach/staff',
  icon: '🧑‍🏫',
  title: 'Сотрудники',
  text: 'Пригласить тренера или администратора',
}

// «Импорт детей» — всем, кто создаёт players (owner/admin/coach): тренер, перевёзший
// свою группу сам, — валидный сценарий. Сервер скоупит группы по роли.
const IMPORT_SECTION: Section = {
  key: 'import',
  href: '/coach/import',
  icon: '📥',
  title: 'Импорт детей',
  text: 'Список из Excel → ссылки-приглашения родителям',
}

export const sectionsForRoles = (user: { roles?: string[] | null } | null | undefined): Section[] => {
  const roles = Array.isArray(user?.roles) ? user!.roles! : []
  const staff = roles.includes('owner') || roles.includes('admin') || roles.includes('coach')
  if (!staff) return PARENT_SECTIONS
  const manager = roles.includes('owner') || roles.includes('admin')
  return manager
    ? [...STAFF_SECTIONS, PAYMENTS_SECTION, MANAGER_SECTION, IMPORT_SECTION]
    : [...STAFF_SECTIONS, IMPORT_SECTION]
}

// locked: режим /pending — карточки видны, переходы закрыты (замок).
export const SectionCards = ({ sections, locked }: { sections: Section[]; locked?: boolean }) => (
  <div className="stack-sm">
    {sections.map((s) => {
      const disabled = locked || s.soon
      const inner = (
        <>
          <span aria-hidden style={{ fontSize: '1.6rem', lineHeight: 1.2 }}>
            {disabled ? (locked && !s.soon ? '🔒' : s.icon) : s.icon}
          </span>
          <div>
            <strong style={{ display: 'block', marginBottom: '0.15rem' }}>
              {s.title}
              {s.soon && (
                <span className="muted small" style={{ marginLeft: '0.4rem' }}>
                  скоро
                </span>
              )}
            </strong>
            <span style={{ color: 'var(--muted)', fontSize: '0.9rem' }}>{s.text}</span>
          </div>
          {!disabled && <span style={{ marginLeft: 'auto', color: 'var(--faint)' }}>›</span>}
        </>
      )
      return disabled ? (
        <div key={s.key} className="card row" style={{ alignItems: 'flex-start', opacity: 0.55 }}>
          {inner}
        </div>
      ) : (
        <Link key={s.key} href={s.href} className="card row" style={{ alignItems: 'flex-start' }}>
          {inner}
        </Link>
      )
    })}
  </div>
)
