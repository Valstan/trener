import config from '@payload-config'
import type { Metadata } from 'next'
import Link from 'next/link'
import { getPayload } from 'payload'
import React from 'react'

import { CONSENT_POLICY_VERSION } from '@/lib/consent'
import {
  branchPrivacyHref,
  isOperatorFinalized,
  operatorFromBranch,
  PROCESSOR_NAME,
} from '@/lib/operator'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Политика обработки персональных данных',
  description: 'Как футбольная школа обрабатывает данные ребёнка и родителя.',
}

const Section = ({
  n,
  title,
  children,
}: {
  n: number
  title: string
  children: React.ReactNode
}) => (
  <section style={{ marginTop: '1.75rem' }}>
    <h2 style={{ fontSize: '1.15rem', marginBottom: '0.4rem' }}>
      {n}. {title}
    </h2>
    <div>{children}</div>
  </section>
)

const PrivacyPage = async ({ searchParams }: { searchParams: Promise<{ branch?: string }> }) => {
  const payload = await getPayload({ config })
  const requested = Number((await searchParams).branch)
  const branches = await payload.find({
    collection: 'branches',
    where: { active: { equals: true } },
    sort: 'name',
    limit: 100,
    depth: 0,
    pagination: false,
    overrideAccess: true,
  })
  const branch = Number.isInteger(requested)
    ? branches.docs.find((item) => item.id === requested)
    : undefined

  if (!branch) {
    return (
      <main className="page" style={{ maxWidth: 760 }}>
        <p className="note">
          <Link href="/">← На главную</Link>
        </p>
        <h1 className="page-title">Политика обработки данных</h1>
        <p className="muted">
          Оператором данных является школа. Выберите филиал, чтобы открыть его реквизиты и редакцию
          документа.
        </p>
        <div className="stack-sm" style={{ marginTop: '1.25rem' }}>
          {branches.docs.map((item) => (
            <Link key={item.id} href={branchPrivacyHref(item.id)} className="card row-between">
              <span>
                <strong>{item.name}</strong>
                {item.city ? <span className="muted small"> · {item.city}</span> : null}
              </span>
              <span aria-hidden>›</span>
            </Link>
          ))}
        </div>
      </main>
    )
  }

  const operator = operatorFromBranch(branch)
  const finalized = isOperatorFinalized(branch)

  return (
    <main className="page" style={{ maxWidth: 760 }}>
      <p className="note">
        <Link href="/privacy">← Выбрать филиал</Link>
      </p>
      <h1 style={{ fontSize: '1.6rem', marginBottom: '0.25rem' }}>
        Политика обработки персональных данных
      </h1>
      <p className="muted" style={{ marginTop: 0 }}>
        {branch.name} · редакция {CONSENT_POLICY_VERSION}
      </p>

      {!finalized && (
        <div role="note" className="card card-muted" style={{ marginTop: '1rem' }}>
          <span className="badge badge-warn" style={{ marginBottom: '0.5rem' }}>
            ⚠️ Тестовый контур
          </span>
          <p style={{ margin: 0 }}>
            Карточка оператора или договор поручения ещё не завершены; документ пока не является
            действующим.
          </p>
        </div>
      )}

      <Section n={1} title="Оператор и обработчик по поручению">
        <p>
          Оператор персональных данных — {operator.legalForm ? `${operator.legalForm} ` : ''}«
          {operator.name}», ИНН {operator.inn || 'не указан'}, адрес:{' '}
          {operator.address || 'не указан'}. Контакт: {operator.email || 'не указан'}
          {operator.phone ? `, тел. ${operator.phone}` : ''}.
        </p>
        <p>
          {PROCESSOR_NAME} обрабатывает данные по поручению школы-оператора в пределах целей и
          действий, перечисленных в договоре поручения.
        </p>
      </Section>
      <Section n={2} title="Какие данные обрабатываются">
        <p>
          Только имя и группа ребёнка, имя родителя и его контакт — телефон и/или email. Паспортные
          данные, адрес проживания и сведения о здоровье приложению не нужны.
        </p>
      </Section>
      <Section n={3} title="Цели обработки">
        <ul>
          <li>расписание и уведомления об изменениях;</li>
          <li>подтверждения участия;</li>
          <li>связь школы с родителем;</li>
          <li>результаты матчей внутри группы.</li>
        </ul>
      </Section>
      <Section n={4} title="Правовое основание">
        <p>
          Согласие законного представителя ребёнка на редакцию {CONSENT_POLICY_VERSION}. Договор
          поручения определяет обработку данных платформой от имени школы.
        </p>
      </Section>
      <Section n={5} title="Действия и хранение">
        <p>
          Сбор, запись, хранение, уточнение, использование и удаление. Первая запись и хранение
          выполняются на серверах в РФ. Срок — период участия ребёнка и до отзыва согласия; после
          отзыва данные удаляются в течение 30 дней, если закон не требует иного.
        </p>
      </Section>
      <Section n={6} title="Передача и уведомления">
        <p>
          Данные не продаются и не передаются для маркетинга. Push-сервисам Apple и Google
          передаётся непрозрачный токен устройства и уведомление без имён и контактов.
        </p>
      </Section>
      <Section n={7} title="Права родителя">
        <p>
          Запрос на доступ, уточнение, блокирование, выгрузку или удаление направляется
          школе-оператору: {operator.email || 'контакт указан в карточке школы'}. Платформа
          предоставляет школе техническую возможность исполнить запрос.
        </p>
      </Section>
      <Section n={8} title="Защита данных">
        <p>
          Доступ разграничен по ролям и филиалам, передача идёт по защищённому каналу, секреты
          изолированы, действия администраторов контролируются.
        </p>
      </Section>
      <Section n={9} title="Изменения политики">
        <p>
          При существенном изменении состава данных или целей школа запросит новое согласие. Текущая
          редакция — {CONSENT_POLICY_VERSION}.
        </p>
      </Section>
    </main>
  )
}

export default PrivacyPage
