import config from '@payload-config'
import { headers as nextHeaders } from 'next/headers'
import { redirect } from 'next/navigation'
import { getPayload } from 'payload'
import React from 'react'

import { isParent } from '@/access/roles'
import { CONSENT_POLICY_VERSION } from '@/lib/consent'

import { ConsentForm } from './ConsentForm'

// Экран согласия 152-ФЗ при онбординге родителя. Минимальная запись (галка осознанного
// согласия + версия политики); полноценный UX «отдельной бумагой» с текстом политики —
// PR3. Доступ — только залогиненному родителю.
export const dynamic = 'force-dynamic'

const container: React.CSSProperties = {
  maxWidth: 560,
  margin: '0 auto',
  padding: '4rem 1.5rem',
  minHeight: '100vh',
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
        Для участия в школе нужно ваше согласие как законного представителя на обработку
        персональных данных ребёнка (152-ФЗ). Мы храним только имя, группу и ваш контакт —
        для расписания и уведомлений.
      </p>
      {childNames.length > 0 ? (
        <p>
          Согласие касается:{' '}
          <strong>{childNames.join(', ')}</strong>.
        </p>
      ) : null}
      <ConsentForm policyVersion={CONSENT_POLICY_VERSION} />
    </main>
  )
}

export default ConsentPage
