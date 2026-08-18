import { APIError } from 'payload'
import { NextResponse } from 'next/server'

// Проброс публичной Payload-ошибки (например, лимит витрины D-029 из demoGuestLimit)
// в JSON-ответ кастомного роута: { ok:false, error } + статус ошибки. Форма покажет
// текст сервера вместо generic «Не удалось отправить». Непубличные и прочие ошибки —
// null, роут отдаёт свой прежний ответ (500/403), внутренности наружу не текут.
export const apiErrorResponse = (err: unknown): NextResponse | null =>
  err instanceof APIError && err.isPublic
    ? NextResponse.json({ ok: false, error: err.message }, { status: err.status })
    : null
