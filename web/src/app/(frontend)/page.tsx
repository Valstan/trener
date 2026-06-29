import config from '@payload-config'
import { headers as nextHeaders } from 'next/headers'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getPayload } from 'payload'
import React from 'react'

import { homePathForUser } from '@/lib/auth/home'

// Публичный лендинг для гостя. Залогиненного сразу уводим на его экран по роли —
// иначе вошедший видит лендинг с кнопкой «Войти» и «зацикливается». force-dynamic:
// страница теперь читает сессию в рантайме; сборку это не ломает (dynamic-страницы
// не исполняются на build, Postgres при сборке по-прежнему не нужен).
export const dynamic = 'force-dynamic'

const FEATURES: { ic: string; title: string; text: string }[] = [
  { ic: '📅', title: 'Расписание', text: 'Тренировки группы всегда под рукой — время и место.' },
  { ic: '🔔', title: 'Изменения', text: 'Перенос или отмена — уведомление сразу, не потеряется.' },
  { ic: '✅', title: 'Подтверждение', text: 'Один тап «Вижу» — тренер знает, что вы в курсе.' },
  { ic: '📣', title: 'Объявления', text: 'Сборы, форма, новости школы — в общей ленте.' },
]

const HomePage = async () => {
  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers: await nextHeaders() })
  if (user) {
    const home = homePathForUser(user)
    if (home !== '/') redirect(home)
  }

  return (
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
}

export default HomePage
