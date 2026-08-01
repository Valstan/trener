import React from 'react'

import { AUTHOR_CREDIT_LABEL, AUTHOR_PORTFOLIO_URL } from '@/lib/ecosystem'

// Подпись автора для подвала лендинга и экрана «Аккаунт». Пока URL портфолио
// в ecosystem.ts = null — просто текст; когда прод портфолио оживёт, та же
// строка станет ссылкой без правок здесь. rel="author" — семантика подписи,
// noopener — чужой домен, как в ServicesCatalogLink.

export const AuthorCredit = ({ style }: { style?: React.CSSProperties }) =>
  AUTHOR_PORTFOLIO_URL ? (
    <a
      href={AUTHOR_PORTFOLIO_URL}
      rel="author noopener noreferrer"
      target="_blank"
      style={{ color: 'var(--faint)', ...style }}
    >
      {AUTHOR_CREDIT_LABEL}
    </a>
  ) : (
    <span style={{ color: 'var(--faint)', ...style }}>{AUTHOR_CREDIT_LABEL}</span>
  )
