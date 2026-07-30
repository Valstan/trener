'use client'

import { useEffect } from 'react'

// Открытие темы двигает отметку прочтения (M9) — по ней в списке гаснет точка
// «есть новое». Идемпотентно, повтор безвреден; ошибку глотаем — прочитанность
// сверит следующий заход, ради неё не стоит показывать пользователю ошибку.
export const MarkTopicRead = ({ topicId }: { topicId: number }) => {
  useEffect(() => {
    fetch('/chat/read', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ topicId }),
    }).catch(() => {})
  }, [topicId])

  return null
}
