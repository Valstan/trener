'use client'

import { useEffect } from 'react'

// Открытие нитки тренером гасит «новый» (new→read) — как инбокс на маунте списка.
// Идемпотентно (эндпоинт двигает статус, повтор безвреден); ошибку глотаем —
// прочитанность сверит следующий заход.
export const MarkRead = ({ questionId, status }: { questionId: number; status: string }) => {
  useEffect(() => {
    if (status !== 'new') return
    fetch(`/coach/question/${questionId}/status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'read' }),
    }).catch(() => {})
  }, [questionId, status])

  return null
}
