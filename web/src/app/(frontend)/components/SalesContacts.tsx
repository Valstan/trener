import React from 'react'

import { SALES_CONTACTS } from '@/lib/salesContacts'

// Список каналов связи с продавцом платформы. Одна строка на канал: на 375px
// «✈️ Телеграм — @Val_Stanley» помещается без переноса. Внешние ссылки уходят в
// новую вкладку с rel="noopener" (как ServicesCatalogLink), а tel:/mailto: — в
// той же: их перехватывает звонилка или почтовый клиент, новая вкладка оставила
// бы после себя пустую.

export const SalesContacts = () => (
  <ul className="list-reset stack-sm" style={{ margin: 0 }}>
    {SALES_CONTACTS.map((c) => {
      const text = (
        <>
          <span style={{ fontWeight: 600 }}>{c.label}</span>
          <span className="muted"> — {c.value}</span>
        </>
      )
      return (
        <li key={c.label} className="row" style={{ alignItems: 'baseline' }}>
          <span aria-hidden style={{ fontSize: '1.05rem' }}>
            {c.ic}
          </span>
          <span style={{ fontSize: '0.9rem' }}>
            {c.href ? (
              <a
                href={c.href}
                {...(c.href.startsWith('https')
                  ? { target: '_blank', rel: 'noopener noreferrer' }
                  : {})}
              >
                {text}
              </a>
            ) : (
              text
            )}
          </span>
        </li>
      )
    })}
  </ul>
)
