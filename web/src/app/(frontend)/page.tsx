import Link from 'next/link'
import React from 'react'

// Публичный лендинг. Залогиненного пользователя по роли разводят сами экраны
// (/parent, /coach) — здесь только вход. Страница статична (без обращения к БД),
// чтобы сборка не требовала Postgres.

const FEATURES: { ic: string; title: string; text: string }[] = [
  { ic: '📅', title: 'Расписание', text: 'Тренировки группы всегда под рукой — время и место.' },
  { ic: '🔔', title: 'Изменения', text: 'Перенос или отмена — уведомление сразу, не потеряется.' },
  { ic: '✅', title: 'Подтверждение', text: 'Один тап «Вижу» — тренер знает, что вы в курсе.' },
  { ic: '📣', title: 'Объявления', text: 'Сборы, форма, новости школы — в общей ленте.' },
]

const HomePage = () => (
  <main className="page" style={{ display: 'flex', flexDirection: 'column' }}>
    <section
      style={{
        textAlign: 'center',
        padding: '2.5rem 0 1.5rem',
      }}
    >
      <div
        aria-hidden
        style={{
          fontSize: '3.5rem',
          lineHeight: 1,
          marginBottom: '1rem',
          filter: 'drop-shadow(0 6px 16px rgba(34,197,94,0.25))',
        }}
      >
        ⚽
      </div>
      <h1 style={{ fontSize: '2rem', margin: '0 0 0.5rem' }}>Футбольная школа</h1>
      <p style={{ color: 'var(--muted)', margin: '0 auto 1.75rem', maxWidth: 360 }}>
        Расписание, изменения и подтверждения — для родителей и тренеров в одном месте.
      </p>
      <Link href="/login" className="btn btn-primary btn-block" style={{ maxWidth: 320, margin: '0 auto' }}>
        Войти →
      </Link>
      <p className="note" style={{ marginTop: '0.85rem' }}>
        Без пароля — пришлём ссылку для входа на email.
      </p>
    </section>

    <section className="stack" style={{ margin: '1rem 0 2rem' }}>
      {FEATURES.map((f) => (
        <div key={f.title} className="card row" style={{ alignItems: 'flex-start' }}>
          <span aria-hidden style={{ fontSize: '1.6rem', lineHeight: 1.2 }}>
            {f.ic}
          </span>
          <div>
            <strong style={{ display: 'block', marginBottom: '0.15rem' }}>{f.title}</strong>
            <span style={{ color: 'var(--muted)', fontSize: '0.9rem' }}>{f.text}</span>
          </div>
        </div>
      ))}
    </section>

    <footer
      style={{
        marginTop: 'auto',
        paddingTop: '1.5rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.6rem',
        alignItems: 'center',
        textAlign: 'center',
        fontSize: '0.85rem',
        color: 'var(--muted)',
      }}
    >
      <Link href="/privacy">Политика обработки персональных данных</Link>
      <Link href="/admin" style={{ color: 'var(--faint)' }}>
        Панель координатора →
      </Link>
    </footer>
  </main>
)

export default HomePage
