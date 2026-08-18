import type { Metadata } from 'next'
import Link from 'next/link'
import React from 'react'

import type { DemoRole } from '@/lib/demo/constants'

// Публичная витрина демо-режима (D-029): вход без регистрации, 5 общих
// аккаунтов по роли. Страница НЕ гейтится авторизацией и не редиректит уже
// вошедшего — открыв /demo, залогиненный демо-юзер видит те же кнопки и
// может сменить роль (это и есть «Сменить роль» без отдельного экрана).
export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Демо — Футбольная школа',
}

const ROLE_BUTTONS: { role: DemoRole; title: string; text: string }[] = [
  { role: 'owner', title: 'Владелец сети', text: 'Панель координатора: филиалы, тренеры, сводка по школе.' },
  {
    role: 'admin',
    title: 'Бухгалтер (администратор филиала)',
    text: 'Панель координатора одного филиала: расписание, оплаты, заявки.',
  },
  { role: 'coach', title: 'Тренер', text: 'Расписание группы, отметки посещаемости, объявления.' },
  { role: 'parent', title: 'Родитель', text: 'Расписание ребёнка, изменения, подтверждение одним тапом.' },
  { role: 'child', title: 'Ребёнок', text: 'Своя лента: расписание и объявления команды.' },
]

const DemoPage = async ({
  searchParams,
}: {
  searchParams: Promise<{ state?: string }>
}) => {
  const { state } = await searchParams
  const preparing = state === 'preparing'

  return (
    <main className="page" style={{ maxWidth: 460 }}>
      <div style={{ textAlign: 'center', padding: '2rem 0 1.5rem' }}>
        <div aria-hidden style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>
          🎮
        </div>
        <h1 style={{ fontSize: '1.6rem', margin: '0 0 0.35rem' }}>Демо-доступ</h1>
        <p style={{ color: 'var(--muted)', margin: 0 }}>
          Без регистрации и пароля — выберите роль и посмотрите, как выглядит приложение.
        </p>
      </div>

      {preparing ? (
        <div className="card card-muted" role="alert">
          Демо готовится, загляните позже.
        </div>
      ) : (
        <div className="stack-sm">
          {ROLE_BUTTONS.map(({ role, title, text }) => (
            <form key={role} method="post" action="/demo/login">
              <input type="hidden" name="role" value={role} />
              <button type="submit" className="btn btn-primary btn-block">
                {title}
              </button>
              <p className="note" style={{ textAlign: 'center', margin: '0.35rem 0 0.85rem' }}>
                {text}
              </p>
            </form>
          ))}
        </div>
      )}

      <p className="note" style={{ textAlign: 'center', marginTop: '1.5rem' }}>
        <Link href="/">← На главную</Link>
      </p>
    </main>
  )
}

export default DemoPage
