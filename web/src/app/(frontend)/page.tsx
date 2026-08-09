import config from '@payload-config'
import { headers as nextHeaders } from 'next/headers'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getPayload } from 'payload'
import React from 'react'

import { homePathForUser } from '@/lib/auth/home'

import { AuthorCredit } from './components/AuthorCredit'
import { Metrika, MetrikaInformer } from './components/Metrika'
import { SalesContacts } from './components/SalesContacts'
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

// Шаги подключения (D-017-витрина): директор школы после буллетов упирался прямо
// в список контактов — «что дальше» не отвечал никто. Шаги совпадают с реальным
// порядком в продукте: филиал и реквизиты → договор поручения на сайте (D-016) →
// импорт детей и приглашения родителям.
const HOW_TO_START: { n: string; title: string; text: string }[] = [
  { n: '1', title: 'Связаться', text: 'Пишете в любой канал ниже — договариваемся о демо на 15 минут.' },
  { n: '2', title: 'Завести школу', text: 'Создаём ваш филиал, вносим реквизиты и цену абонемента.' },
  {
    n: '3',
    title: 'Подписать договор',
    text: 'Договор поручения на обработку данных подписывается прямо на сайте — юрист не нужен.',
  },
  {
    n: '4',
    title: 'Пригласить родителей',
    text: 'Загружаем список детей из таблицы, родители заходят по ссылке из письма.',
  },
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
    {/* Счётчик Метрики — ТОЛЬКО на публичной странице (D-017), не в layout. */}
    <Metrika />
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
      {/* Явный CTA регистрации: раньше «создать аккаунт» был ghost-кнопкой внутри
          формы входа — новый родитель/тренер не понимал, что сюда можно записаться. */}
      <Link
        href="/login?mode=register"
        className="btn btn-block"
        style={{ maxWidth: 320, margin: '0.6rem auto 0' }}
      >
        Зарегистрироваться
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
        <div className="divider" style={{ margin: '1rem 0' }} />
        <strong style={{ display: 'block', marginBottom: '0.6rem' }}>Как подключиться</strong>
        <ol className="list-reset stack-sm" style={{ margin: 0 }}>
          {HOW_TO_START.map((s) => (
            <li key={s.n} className="row" style={{ alignItems: 'flex-start' }}>
              <span
                aria-hidden
                className="badge"
                style={{ minWidth: '1.6rem', textAlign: 'center', lineHeight: 1.4 }}
              >
                {s.n}
              </span>
              <span style={{ fontSize: '0.9rem' }}>
                <strong>{s.title}.</strong> {s.text}
              </span>
            </li>
          ))}
        </ol>
        <p style={{ color: 'var(--muted)', fontSize: '0.9rem', margin: '0.85rem 0 0' }}>
          Реально это один день, из которого ваша работа — полчаса.
        </p>

        <div className="divider" style={{ margin: '1rem 0' }} />
        <strong style={{ display: 'block', marginBottom: '0.35rem' }}>Сколько стоит</strong>
        <p style={{ color: 'var(--muted)', fontSize: '0.9rem', margin: '0 0 0.6rem' }}>
          Подписка за филиал, стоимость — по договорённости. <strong>Первый месяц бесплатно</strong>:
          пробуете на одной группе, платите, только если останетесь. Эквайринга нет — родители платят
          школе как раньше, приложение ведёт учёт.
        </p>

        <div className="divider" style={{ margin: '1rem 0' }} />
        <strong style={{ display: 'block', marginBottom: '0.6rem' }}>Связаться</strong>
        <SalesContacts />
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
      {/* Видимый информер посещаемости (D-017) — рядом с подписью автора и только
          здесь: в кабинетах школы счётчика нет намеренно. */}
      <MetrikaInformer />
      <Link href="/privacy">Политика обработки персональных данных</Link>
      {/* Ссылки на /admin здесь больше нет: гостю она открывала форму логина CMS
          с email+паролем, которых у родителя не существует. Владелец попадает в
          панель через свой /home. */}
    </footer>
  </main>
  )
}

export default HomePage
