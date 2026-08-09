import config from '@payload-config'
import Link from 'next/link'
import { headers as nextHeaders } from 'next/headers'
import { redirect } from 'next/navigation'
import { getPayload } from 'payload'
import React from 'react'

import { isParent, isPending } from '@/access/roles'
import { activeDocument, branchCanAcceptConsents, renderLegalBody } from '@/lib/legal'
import { branchPrivacyHref, operatorFromBranch, PROCESSOR_NAME } from '@/lib/operator'
import { relId } from '@/lib/relId'

import { ConsentForm } from './ConsentForm'

// Экран согласия 152-ФЗ при онбординге родителя — отдельный осознанный акт (§5.3).
// С D-016 текст согласия — ВЕРСИОНИРУЕМЫЙ ДОКУМЕНТ из БД (kind=parent_consent):
// показывается действующая версия с подставленными реквизитами филиала-оператора,
// подпись пишется в неизменяемый журнал с hash версии.
//
// Жёсткий гейт (вместо прежней мягкой плашки «Тестовый контур»): филиал без полных
// реквизитов и подписанного договора поручения согласия НЕ принимает.
export const dynamic = 'force-dynamic'

const ConsentPage = async () => {
  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers: await nextHeaders() })

  if (!user) redirect('/login')
  if (isPending(user)) redirect('/pending')
  if (!isParent(user)) redirect('/')

  // Родитель без филиала (легаси-данные до фикса invite-пути): оператора подставить
  // не из чего — в кабинет, БЕЗ записи согласия. Редирект на /pending здесь раньше
  // гонял approved-родителя по кругу pending → refresh-session → parent.
  const branchId = relId(user.branch)
  if (branchId == null) redirect('/parent')
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

  const doc = await activeDocument(payload, 'parent_consent')
  const branchReady = branchCanAcceptConsents(branch)

  return (
    <main className="page" style={{ maxWidth: 560 }}>
      <h1 className="page-title">Согласие на обработку данных</h1>
      <p className="muted" style={{ marginTop: 0 }}>
        Как законный представитель ребёнка вы даёте согласие на обработку его персональных данных
        (152-ФЗ). Обработчик по поручению школы — {PROCESSOR_NAME}. Полный текст политики — в{' '}
        <Link href={branchPrivacyHref(branch.id)}>политике обработки данных</Link>.
      </p>

      {childNames.length > 0 ? (
        <p>
          Согласие касается: <strong>{childNames.join(', ')}</strong>.
        </p>
      ) : null}

      {!branchReady ? (
        <div className="card stack-sm" style={{ borderColor: 'var(--danger-border)' }}>
          <strong>Филиал ещё не завершил юридическое подключение</strong>
          <span className="muted small">
            Школа «{branch.name}» пока не заполнила реквизиты оператора или не подписала договор
            поручения — принимать согласия она не вправе. Сообщите администрации школы; как только
            подключение завершится, этот экран откроется снова.
          </span>
        </div>
      ) : !doc ? (
        <div className="card stack-sm">
          <strong>Текст согласия готовится</strong>
          <span className="muted small">Попробуйте позже или сообщите администрации школы.</span>
        </div>
      ) : (
        <>
          <div className="card" style={{ marginTop: '1.25rem' }}>
            <p className="muted small" style={{ marginTop: 0 }}>
              {doc.title} · версия {doc.version}
            </p>
            <pre className="pre" style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit', margin: 0 }}>
              {renderLegalBody(doc.body, operator, {
                CHILDREN: childNames.length ? childNames.join(', ') : '(будут привязаны после подтверждения)',
              })}
            </pre>
          </div>
          <ConsentForm policyVersion={doc.version} privacyHref={branchPrivacyHref(branch.id)} />
        </>
      )}
    </main>
  )
}

export default ConsentPage
