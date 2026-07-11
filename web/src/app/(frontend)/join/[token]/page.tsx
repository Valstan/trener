import config from '@payload-config'
import Link from 'next/link'
import { headers as nextHeaders } from 'next/headers'
import { getPayload } from 'payload'
import React from 'react'

import { isParent } from '@/access/roles'
import { peekInviteToken } from '@/lib/auth/invite'
import { getRadarConfig } from '@/lib/auth/oidc'

import { AcceptAsUser } from './AcceptAsUser'
import { JoinForm } from './JoinForm'

// Лендинг приглашения от тренера. Показывает, какого ребёнка/группу привязываем.
// Три ветки:
//   • залогинен родитель (единый вход/magic-link) → one-click «Принять приглашение»
//     (личность доказана сессией, email-раунд не нужен);
//   • аноним → email-форма (классический путь) + кнопка единого входа Малмыжа с
//     возвратом сюда (?next=) — после входа приглашение принимается one-click'ом;
//   • залогинен персонал → email-форма (ребёнка нельзя записать на coach/admin).
// Привязки на GET НЕ происходит; токен не гасим (peek без мутации).
export const dynamic = 'force-dynamic'

const JoinPage = async ({ params }: { params: Promise<{ token: string }> }) => {
  const { token } = await params

  let preview: Awaited<ReturnType<typeof peekInviteToken>> = { ok: false }
  let sessionParentEmail: string | null = null
  try {
    const payload = await getPayload({ config })
    preview = await peekInviteToken(payload, token)
    const { user } = await payload.auth({ headers: await nextHeaders() })
    if (user && isParent(user)) sessionParentEmail = user.email
  } catch {
    preview = { ok: false }
  }
  const ssoEnabled = getRadarConfig() !== null

  if (!preview.ok) {
    return (
      <main className="page" style={{ maxWidth: 460 }}>
        <div style={{ textAlign: 'center', padding: '2rem 0 0.5rem' }}>
          <div aria-hidden style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>
            ⚽
          </div>
          <h1 className="page-title">Приглашение недействительно</h1>
        </div>
        <p className="muted">
          Ссылка-приглашение истекла или уже использована. Попросите тренера прислать новую.
        </p>
        <p className="note" style={{ textAlign: 'center', marginTop: '1.5rem' }}>
          <Link href="/">← На главную</Link>
        </p>
      </main>
    )
  }

  return (
    <main className="page" style={{ maxWidth: 460 }}>
      <div style={{ textAlign: 'center', padding: '2rem 0 1rem' }}>
        <div aria-hidden style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>
          ⚽
        </div>
        <h1 className="page-title" style={{ marginBottom: '0.5rem' }}>
          Приглашение в школу
        </h1>
      </div>
      <p style={{ marginTop: 0 }}>
        Вас приглашают как родителя ребёнка <strong>{preview.playerName}</strong>
        {preview.groupName ? (
          <>
            {' '}
            (группа <strong>{preview.groupName}</strong>)
          </>
        ) : null}
        .
      </p>
      {sessionParentEmail ? (
        <AcceptAsUser token={token} email={sessionParentEmail} />
      ) : (
        <>
          {ssoEnabled && (
            <>
              {/* Возврат сюда после единого входа (?next=) — приглашение примется one-click'ом. */}
              <a
                className="btn btn-primary btn-block"
                href={`/auth/vk/start?next=${encodeURIComponent(`/join/${token}`)}`}
                style={{ marginTop: '0.5rem' }}
              >
                Войти через Малмыж и принять
              </a>
              <p className="note" style={{ textAlign: 'center', margin: '1rem 0 0' }}>
                или по email
              </p>
            </>
          )}
          <p className="muted">
            Введите свой email — пришлём ссылку для подтверждения и входа. Пароль не нужен.
          </p>
          <JoinForm token={token} />
        </>
      )}
    </main>
  )
}

export default JoinPage
