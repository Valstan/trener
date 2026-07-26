import React from 'react'

import { SERVICES_CATALOG_LABEL, SERVICES_CATALOG_URL } from '@/lib/ecosystem'

// Кнопка в каталог сервисов Малмыжа (стандарт онбординга экосистемы, директива
// Мозга 2026-07-26). Уходит на чужой домен → новая вкладка + rel="noopener",
// чтобы каталог не получил доступ к window.opener нашего приложения.

export const ServicesCatalogLink = ({
  className = 'btn btn-ghost btn-sm',
  style,
}: {
  className?: string
  style?: React.CSSProperties
}) => (
  <a
    href={SERVICES_CATALOG_URL}
    className={className}
    style={style}
    target="_blank"
    rel="noopener noreferrer"
  >
    <span aria-hidden>🌐</span>
    {SERVICES_CATALOG_LABEL}
  </a>
)
