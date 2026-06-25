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

const container: React.CSSProperties = {
  maxWidth: 480,
  margin: '0 auto',
  padding: '4rem 1.5rem',
  minHeight: '100vh',
}

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
      <main style={container}>
        <h1 style={{ fontSize: '1.5rem' }}>Приглашение недействительно</h1>
        <p style={{ color: 'var(--muted)' }}>
          Ссылка-приглашение истекла или уже использована. Попросите тренера прислать новую.
        </p>
        <p>
          <Link href="/">← На главную</Link>
        </p>
      </main>
    )
  }

  return (
    <main style={container}>
      <h1 style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>Приглашение в Футбольную школу</h1>
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
      <p style={{ color: 'var(--muted)' }}>
        Введите свой email — пришлём ссылку для подтверждения и входа. Пароль не нужен.
      </p>
      <JoinForm token={token} />
    </main>
  )
}

export default JoinPage
