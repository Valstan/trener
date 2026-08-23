import { NextResponse } from 'next/server'

// Лёгкий health-эндпоинт для deploy-smoke (#011). Не под /api/* (там Payload REST по
// слагам коллекций), не требует БД/авторизации — отвечает 200, если рантайм поднялся.
// Прод-smoke (deploy-prod.yml) дёргает /health по loopback на сервере после рестарта (порт — из env бокса).
export const dynamic = 'force-dynamic'

export const GET = (): Response => NextResponse.json({ ok: true, service: 'trener' })
