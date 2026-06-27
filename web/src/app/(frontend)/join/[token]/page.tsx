import config from '@payload-config'
import Link from 'next/link'
import { getPayload } from 'payload'
import React from 'react'

import { peekInviteToken } from '@/lib/auth/invite'

import { JoinForm } from './JoinForm'

// Лендинг приглашения от тренера. Показывает, какого ребёнка/группу привязываем,
// и просит email родителя. Привязки здесь НЕ происходит — только после клика по
// письму (доказанное владение email). Токен не гасим (peek без мутации).
export const dynamic = 'force-dynamic'

const JoinPage = async ({ params }: { params: Promise<{ token: string }> }) => {
  const { token } = await params

  let preview: Awaited<ReturnType<typeof peekInviteToken>> = { ok: false }
  try {
    const payload = await getPayload({ config })
    preview = await peekInviteToken(payload, token)
  } catch {
    preview = { ok: false }
  }

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
      <p className="muted">
        Введите свой email — пришлём ссылку для подтверждения и входа. Пароль не нужен.
      </p>
      <JoinForm token={token} />
    </main>
  )
}

export default JoinPage
