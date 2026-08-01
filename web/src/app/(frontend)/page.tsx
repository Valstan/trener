import config from '@payload-config'
import { headers as nextHeaders } from 'next/headers'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getPayload } from 'payload'
import React from 'react'

import { homePathForUser } from '@/lib/auth/home'

import { AuthorCredit } from './components/AuthorCredit'
import { ServicesCatalogLink } from './components/ServicesCatalogLink'

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

// Буллеты для руководителя школы (п.11 аудита продажной готовности): лендинг должен
// говорить не только с родителем этой школы, но и с покупателем — директором школы
// из другого города. Формулировки — по docs/branch-onboarding-privacy.md и видению v2
// (деньги через приложение не ходят, оператор ПДн — школа).
const FOR_SCHOOL: { ic: string; text: string }[] = [
  {
    ic: '💬',
    text: 'Расписание и переносы — без чатов в WhatsApp: изменение доходит до каждого родителя уведомлением.',
  },
  {
    ic: '👀',
    text: 'Родители видят изменения и подтверждают одним тапом — никто не «не знал».',
  },
  {
    ic: '🧮',
    text: 'Тренер видит «приняли N из M» и знает, кому напомнить лично.',
  },
  {
    ic: '💳',
    text: 'Учёт оплаты — только отметки. Деньги через приложение не ходят: родители платят школе как раньше.',
  },
  {
    ic: '🔒',
    text: 'Данные детей — по минимуму. Оператор персональных данных — ваша школа, платформа обрабатывает их по её поручению.',
  },
]

const HomePage = async () => {
  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers: await nextHeaders() })
  if (user) {
    const home = homePathForUser(user)
    if (home !== '/') redirect(home)
  }

  // Контакт для подключения школ. mailto: или https-ссылка из env — email/телефон
  // в код не зашиваем (реквизиты живут в окружении, не в репо). Пусто → кнопки нет,
  // отправляем в каталог сервисов Малмыжа.
  const salesContact = process.env.NEXT_PUBLIC_SALES_CONTACT?.trim() ?? ''

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

    <section className="stack" style={{ margin: '1rem 0 1rem' }}>
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

    {/* Секция для покупателя — директора школы (п.11 аудита). Родительскую витрину
        выше не трогает: гость-родитель её просто пролистывает. */}
    <section style={{ margin: '0 0 2rem' }}>
      <h2 className="section-title">Подключить свою школу</h2>
      <p style={{ color: 'var(--muted)', fontSize: '0.9rem', margin: '0 0 0.85rem' }}>
        Этот сайт — школа в Малмыже. Она работает на платформе «Тренер», и той же
        платформой может пользоваться ваша школа — в любом городе.
      </p>
      <div className="card">
        <ul className="list-reset stack-sm" style={{ margin: 0 }}>
          {FOR_SCHOOL.map((b) => (
            <li key={b.ic} className="row" style={{ alignItems: 'flex-start' }}>
              <span aria-hidden style={{ fontSize: '1.1rem', lineHeight: 1.4 }}>
                {b.ic}
              </span>
              <span style={{ fontSize: '0.9rem' }}>{b.text}</span>
            </li>
          ))}
        </ul>
        <div style={{ marginTop: '1rem' }}>
          {salesContact ? (
            // mailto открываем в той же вкладке (уйдёт в почтовый клиент), внешнюю
            // ссылку — в новой + noopener, как в ServicesCatalogLink.
            <a
              href={salesContact}
              className="btn btn-primary btn-block"
              {...(salesContact.startsWith('mailto:')
                ? {}
                : { target: '_blank', rel: 'noopener noreferrer' })}
            >
              Связаться →
            </a>
          ) : (
            <>
              <p className="note" style={{ margin: '0 0 0.6rem' }}>
                Напишите нам через каталог сервисов Малмыжа:
              </p>
              <ServicesCatalogLink className="btn btn-ghost btn-sm btn-block" />
            </>
          )}
        </div>
      </div>
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
      <ServicesCatalogLink style={{ marginBottom: '0.5rem' }} />
      <span style={{ color: 'var(--faint)' }}>Работает на платформе «Тренер»</span>
      <AuthorCredit />
      <Link href="/privacy">Политика обработки персональных данных</Link>
      <Link href="/admin" style={{ color: 'var(--faint)' }}>
        Панель управления школой →
      </Link>
    </footer>
  </main>
  )
}

export default HomePage
