import React from 'react'

import { formatDateTime } from '@/lib/notifications/describe'

export type ThreadMessage = {
  id: string
  authorRole: 'parent' | 'coach'
  authorName: string
  body: string
  createdAt: string | null
}

// Нитка чата M4 (server-render). Реплики тренера визуально отличены от родительских
// (акцентная рамка + сторона), автор — по authorRole (author может быть SET NULL
// после удаления аккаунта — имя-fallback подставляет страница).
export const ThreadMessages = ({ messages }: { messages: ThreadMessage[] }) => (
  <div className="stack-sm">
    {messages.map((m) => (
      <div
        key={m.id}
        className={m.authorRole === 'coach' ? 'card card-accent stack-xs' : 'card stack-xs'}
        style={m.authorRole === 'coach' ? { marginLeft: '1.5rem' } : { marginRight: '1.5rem' }}
      >
        <div className="row-between" style={{ alignItems: 'baseline' }}>
          <strong>{m.authorName}</strong>
          <span className="muted small" style={{ whiteSpace: 'nowrap' }}>
            {m.createdAt ? formatDateTime(m.createdAt) : ''}
          </span>
        </div>
        <p className="pre" style={{ margin: 0 }}>
          {m.body}
        </p>
      </div>
    ))}
  </div>
)
