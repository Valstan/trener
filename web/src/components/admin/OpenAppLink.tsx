import React from 'react'

// Ссылка из Payload-админки на фронт-приложение (расписание/матчи/объявления/вопросы).
// Персонал (admin/coach) заходит в CMS, но «живой» интерфейс — на фронте; без этой
// ссылки координатор оказывался заперт в панели. Обычный <a> — намеренно полный
// переход, уводящий из admin-SPA на Next-роут /coach/schedule (он пускает и admin,
// и coach). Рендерится в nav через admin.components.afterNavLinks.
const OpenAppLink: React.FC = () => (
  <a
    href="/coach/schedule"
    style={{
      display: 'flex',
      alignItems: 'center',
      gap: '0.5rem',
      margin: '0.5rem 0',
      padding: '0.5rem 0.75rem',
      borderRadius: 6,
      border: '1px solid var(--theme-elevation-150)',
      background: 'var(--theme-elevation-50)',
      color: 'var(--theme-text)',
      textDecoration: 'none',
      fontWeight: 600,
      fontSize: '0.9rem',
    }}
  >
    <span aria-hidden>⚽</span>
    Открыть приложение
  </a>
)

export default OpenAppLink
