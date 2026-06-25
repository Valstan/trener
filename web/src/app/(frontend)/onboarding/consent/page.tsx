import config from '@payload-config'
import Link from 'next/link'
import { headers as nextHeaders } from 'next/headers'
import { redirect } from 'next/navigation'
import { getPayload } from 'payload'
import React from 'react'

import { isParent } from '@/access/roles'
import { CONSENT_POLICY_VERSION } from '@/lib/consent'
import { OPERATOR } from '@/lib/operator'

import { ConsentForm } from './ConsentForm'

// Экран согласия 152-ФЗ при онбординге родителя — отдельный осознанный акт (§5.3):
// явно перечисляем оператора, цели, состав данных, действия и срок хранения + ссылку
// на полную политику; запись фиксирует версию (CONSENT_POLICY_VERSION). Чекбокс не
// предзаполнен. Доступ — только залогиненному родителю.
export const dynamic = 'force-dynamic'

const container: React.CSSProperties = {
  maxWidth: 560,
  margin: '0 auto',
  padding: '4rem 1.5rem',
  minHeight: '100vh',
}

const factsBox: React.CSSProperties = {
  marginTop: '1.25rem',
  padding: '1rem 1.25rem',
  borderRadius: 10,
  border: '1px solid #1f3a2c',
  background: '#11261c',
  fontSize: '0.95rem',
}

const ConsentPage = async () => {
  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers: await nextHeaders() })

  if (!user) redirect('/login')
  if (!isParent(user)) redirect('/')

  const players = await payload.find({
    collection: 'players',
    where: { parent: { equals: user.id } },
    limit: 100,
    depth: 0,
    pagination: false,
    user,
    overrideAccess: false,
  })
  const childNames = players.docs.map((p) => p.name).filter(Boolean)

  return (
    <main style={container}>
      <h1 style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>Согласие на обработку данных</h1>
      <p style={{ color: 'var(--muted)', marginTop: 0 }}>
        Как законный представитель ребёнка вы даёте согласие на обработку его персональных данных
        (152-ФЗ). Ниже — что именно и зачем; полный текст — в{' '}
        <Link href="/privacy">политике обработки данных</Link>.
      </p>

      {childNames.length > 0 ? (
        <p>
          Согласие касается: <strong>{childNames.join(', ')}</strong>.
        </p>
      ) : null}

      <div style={factsBox}>
        <dl style={{ margin: 0, display: 'grid', gap: '0.6rem' }}>
          <div>
            <dt style={{ color: 'var(--muted)' }}>Оператор</dt>
            <dd style={{ margin: 0 }}>
              {OPERATOR.legalForm} «{OPERATOR.name}»
            </dd>
          </div>
          <div>
            <dt style={{ color: 'var(--muted)' }}>Какие данные</dt>
            <dd style={{ margin: 0 }}>имя и группа ребёнка, ваше имя и контакт (телефон/email)</dd>
          </div>
          <div>
            <dt style={{ color: 'var(--muted)' }}>Цели</dt>
            <dd style={{ margin: 0 }}>
              расписание тренировок, уведомления об изменениях, подтверждения участия и связь с вами
            </dd>
          </div>
          <div>
            <dt style={{ color: 'var(--muted)' }}>Действия и срок</dt>
            <dd style={{ margin: 0 }}>
              хранение на серверах в РФ на период участия; отзыв согласия в любой момент → удаление
            </dd>
          </div>
        </dl>
      </div>

      <ConsentForm policyVersion={CONSENT_POLICY_VERSION} />
    </main>
  )
}

export default ConsentPage
