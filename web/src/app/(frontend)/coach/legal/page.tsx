import config from '@payload-config'
import { headers as nextHeaders } from 'next/headers'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getPayload } from 'payload'
import React from 'react'

import { adminBranchId, hasRole, isOwner } from '@/access/roles'
import { activeDocument, renderLegalBody, requisitesComplete } from '@/lib/legal'
import { operatorFromBranch } from '@/lib/operator'

import { AppShell, COACH_TABS } from '../../components/AppShell'
import { SignAgreementButton } from './SignAgreementButton'

// Юридическое подключение филиала (D-016): договор поручения обработки ПДн живёт
// на сайте — владелец/админ филиала читает текст с подставленными реквизитами СВОЕГО
// филиала и подписывает кнопкой. До подписания филиал не может принимать согласия
// родителей (жёсткий гейт вместо прежней мягкой плашки «Тестовый контур»).
export const dynamic = 'force-dynamic'

const LegalPage = async ({ searchParams }: { searchParams: Promise<{ branch?: string }> }) => {
  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers: await nextHeaders() })
  if (!user) redirect('/login')
  if (!hasRole(user, 'owner', 'admin')) redirect('/home')

  const myBranch = adminBranchId(user)
  const branches = await payload.find({
    collection: 'branches',
    where: myBranch != null ? { id: { equals: myBranch } } : {},
    sort: 'name',
    limit: 200,
    depth: 0,
    pagination: false,
    overrideAccess: true,
  })

  const { branch: branchParam } = await searchParams
  const selectedId = Number(branchParam)
  const selected =
    Number.isInteger(selectedId) && selectedId > 0
      ? branches.docs.find((b) => b.id === selectedId)
      : branches.docs.length === 1
        ? branches.docs[0]
        : undefined

  const doc = await activeDocument(payload, 'processing_agreement')

  return (
    <AppShell title="Юридическое подключение" tabs={COACH_TABS} back={{ href: '/home' }}>
      {!selected ? (
        <div className="stack-sm">
          <p className="muted" style={{ marginTop: 0 }}>
            Выберите филиал: договор поручения подписывается на каждый филиал отдельно —
            оператор данных у каждого свой.
          </p>
          {branches.docs.map((b) => {
            const signed = Boolean(b.processorAgreementSignedAt)
            const ready = requisitesComplete(b)
            return (
              <Link key={b.id} href={`/coach/legal?branch=${b.id}`} className="card row-between">
                <strong>{b.name}</strong>
                <span className={signed ? 'badge' : ready ? 'badge badge-warn' : 'badge badge-danger'}>
                  {signed ? 'Договор подписан' : ready ? 'Готов к подписанию' : 'Заполните реквизиты'}
                </span>
              </Link>
            )
          })}
        </div>
      ) : !doc ? (
        <p className="muted">Текст договора готовится — обратитесь к владельцу платформы.</p>
      ) : (
        <div className="stack">
          <h2 className="section-title" style={{ marginTop: 0 }}>
            {selected.name}
          </h2>
          {!requisitesComplete(selected) ? (
            <div className="card stack-sm" style={{ borderColor: 'var(--danger-border)' }}>
              <strong>Сначала заполните реквизиты оператора</strong>
              <span className="muted small">
                Наименование, форма, ИНН, адрес, email и телефон филиала — в{' '}
                <Link href="/admin">панели управления</Link> (карточка филиала, раздел «Оператор
                персональных данных»). Без них договор подписать нельзя: получатся подписи под
                документом, где оператор пуст.
              </span>
            </div>
          ) : (
            <>
              <div className="card">
                <p className="muted small" style={{ marginTop: 0 }}>
                  {doc.title} · версия {doc.version}
                </p>
                <pre className="pre" style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit', margin: 0 }}>
                  {renderLegalBody(doc.body, operatorFromBranch(selected))}
                </pre>
              </div>
              {selected.processorAgreementSignedAt ? (
                <p className="success-text">
                  ✓ Подписан{' '}
                  {new Date(selected.processorAgreementSignedAt).toLocaleDateString('ru-RU')} — филиал
                  может принимать согласия родителей.
                </p>
              ) : (
                <SignAgreementButton branchId={selected.id} />
              )}
            </>
          )}
        </div>
      )}
    </AppShell>
  )
}

export default LegalPage
