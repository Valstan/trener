import config from '@payload-config'
import Link from 'next/link'
import { headers as nextHeaders } from 'next/headers'
import { redirect } from 'next/navigation'
import { getPayload } from 'payload'
import React from 'react'

import { isParent, isPending } from '@/access/roles'
import { CONSENT_POLICY_VERSION } from '@/lib/consent'
import {
  branchPrivacyHref,
  isOperatorFinalized,
  operatorFromBranch,
  PROCESSOR_NAME,
} from '@/lib/operator'
import { relId } from '@/lib/relId'

import { ConsentForm } from './ConsentForm'

// Экран согласия 152-ФЗ при онбординге родителя — отдельный осознанный акт (§5.3):
// явно перечисляем оператора, цели, состав данных, действия и срок хранения + ссылку
// на полную политику; запись фиксирует версию (CONSENT_POLICY_VERSION). Чекбокс не
// предзаполнен. Доступ — только залогиненному родителю.
export const dynamic = 'force-dynamic'

const ConsentPage = async () => {
  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers: await nextHeaders() })

  if (!user) redirect('/login')
  if (isPending(user)) redirect('/pending')
  if (!isParent(user)) redirect('/')

  const branchId = relId(user.branch)
  if (branchId == null) redirect('/pending')
  const branch = await payload.findByID({
    collection: 'branches',
    id: branchId,
    depth: 0,
    overrideAccess: true,
  })
  const operator = operatorFromBranch(branch)

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
    <main className="page" style={{ maxWidth: 560 }}>
      <h1 className="page-title">Согласие на обработку данных</h1>
      <p className="muted" style={{ marginTop: 0 }}>
        Как законный представитель ребёнка вы даёте согласие на обработку его персональных данных
        (152-ФЗ). Ниже — что именно и зачем; полный текст — в{' '}
        <Link href={branchPrivacyHref(branch.id)}>политике обработки данных</Link>.
      </p>

      {childNames.length > 0 ? (
        <p>
          Согласие касается: <strong>{childNames.join(', ')}</strong>.
        </p>
      ) : null}

      <div className="card" style={{ marginTop: '1.25rem' }}>
        <dl style={{ margin: 0, display: 'grid', gap: '0.7rem' }}>
          <div>
            <dt className="muted small">Оператор</dt>
            <dd style={{ margin: 0 }}>
              {operator.legalForm ? `${operator.legalForm} ` : ''}«{operator.name}»
            </dd>
          </div>
          <div>
            <dt className="muted small">Обработчик по поручению</dt>
            <dd style={{ margin: 0 }}>{PROCESSOR_NAME}</dd>
          </div>
          <div>
            <dt className="muted small">Какие данные</dt>
            <dd style={{ margin: 0 }}>имя и группа ребёнка, ваше имя и контакт (телефон/email)</dd>
          </div>
          <div>
            <dt className="muted small">Цели</dt>
            <dd style={{ margin: 0 }}>
              расписание тренировок, уведомления об изменениях, подтверждения участия и связь с вами
            </dd>
          </div>
          <div>
            <dt className="muted small">Действия и срок</dt>
            <dd style={{ margin: 0 }}>
              хранение на серверах в РФ на период участия; отзыв согласия в любой момент → удаление
            </dd>
          </div>
        </dl>
      </div>

      {!isOperatorFinalized(branch) && (
        <p className="note" role="note">
          Тестовый контур: карточка оператора или договор поручения ещё не завершены.
        </p>
      )}

      <ConsentForm
        policyVersion={CONSENT_POLICY_VERSION}
        privacyHref={branchPrivacyHref(branch.id)}
      />
    </main>
  )
}

export default ConsentPage
