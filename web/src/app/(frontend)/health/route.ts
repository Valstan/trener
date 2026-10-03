import { NextResponse } from 'next/server'

// Лёгкий health-эндпоинт для deploy-smoke (#011). Не под /api/* (там Payload REST по
// слагам коллекций), не требует БД/авторизации — отвечает 200, если рантайм поднялся.
// Прод-smoke (deploy-prod.yml) дёргает /health по loopback на сервере после рестарта (порт — из env бокса).
export const dynamic = 'force-dynamic'

// Имя сервиса убрано (аудит #057, вектор a): публичный fingerprint для сканеров при том,
// что сам проект выставил poweredByHeader:false и проверяет отсутствие X-Powered-By
// смоуком. Смоуку нужен только факт 200 — тело ровно `{"ok":true}`.
export const GET = (): Response => NextResponse.json({ ok: true })
