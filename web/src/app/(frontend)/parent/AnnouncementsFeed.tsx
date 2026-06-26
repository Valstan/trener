'use client'

import React, { useEffect, useState } from 'react'

export type FeedItem = {
  id: number
  title: string
  body: string
  groupName: string | null
  publishedAt: string | null
}

const LS_KEY = 'trener.announcements.lastSeen'

const card = (isNew: boolean): React.CSSProperties => ({
  padding: '0.9rem 1.05rem',
  borderRadius: 10,
  border: `1px solid ${isNew ? '#2c7a4b' : '#1f3a2c'}`,
  background: isNew ? '#11261c' : '#0e2218',
  display: 'grid',
  gap: '0.3rem',
})

const fmt = (iso: string | null): string => {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleString('ru-RU', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })
}

// Лента объявлений родителя. «Новое» — клиентский маркер (F6): сравниваем publishedAt
// с last-seen в localStorage, без серверной per-user строки. На маунте показываем
// бейджи, затем сдвигаем last-seen на самое свежее — следующий заход «новых» не покажет.
export const AnnouncementsFeed = ({ items }: { items: FeedItem[] }) => {
  // На первом рендере (SSR/гидрация) ничего не «новое» — иначе mismatch. После маунта
  // вычисляем по localStorage.
  const [lastSeen, setLastSeen] = useState<number | null>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let stored = 0
    try {
      stored = Number(localStorage.getItem(LS_KEY)) || 0
    } catch {
      stored = 0
    }
    setLastSeen(stored)
    setReady(true)

    // Сдвигаем отметку на самый свежий publishedAt из показанных.
    const newest = items.reduce((max, i) => {
      const t = i.publishedAt ? new Date(i.publishedAt).getTime() : 0
      return Number.isNaN(t) ? max : Math.max(max, t)
    }, 0)
    if (newest > stored) {
      try {
        localStorage.setItem(LS_KEY, String(newest))
      } catch {
        // приватный режим / отключённое хранилище — просто без маркера
      }
    }
  }, [items])

  if (items.length === 0) return null

  const isNew = (iso: string | null): boolean => {
    if (!ready || lastSeen == null || !iso) return false
    const t = new Date(iso).getTime()
    return !Number.isNaN(t) && t > lastSeen
  }

  return (
    <section style={{ display: 'grid', gap: '0.75rem', marginTop: '2rem' }}>
      <h2 style={{ fontSize: '1.05rem', margin: 0 }}>Объявления</h2>
      <div style={{ display: 'grid', gap: '0.6rem' }}>
        {items.map((a) => (
          <article key={a.id} style={card(isNew(a.publishedAt))}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', alignItems: 'baseline' }}>
              <strong>
                {isNew(a.publishedAt) && <span style={{ color: 'var(--accent)', marginRight: '0.4rem' }}>•</span>}
                {a.title}
              </strong>
              <span style={{ color: 'var(--muted)', fontSize: '0.8rem', whiteSpace: 'nowrap' }}>{fmt(a.publishedAt)}</span>
            </div>
            {a.groupName && <div style={{ color: 'var(--muted)', fontSize: '0.85rem' }}>{a.groupName}</div>}
            <p style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{a.body}</p>
          </article>
        ))}
      </div>
    </section>
  )
}
