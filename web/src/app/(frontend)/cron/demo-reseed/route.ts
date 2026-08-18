import config from '@payload-config'
import { getPayload } from 'payload'
import { NextResponse } from 'next/server'

import { seedDemo } from '@/lib/demo/seedDemo'

// Cron: ночной reseed демо-филиала (D-029). Сносит и пересоздаёт содержимое
// ОДНОГО демо-филиала (isDemo: true) — детали идемпотентности/предохранителей
// см. в комментарии над seedDemo (web/src/lib/demo/seedDemo.ts).
//
// Секрет-гард (#008/#011) — по образцу /cron/rsvp-reminders: CRON_SECRET в env;
// вызов с ?secret= или заголовком x-cron-secret. Нет CRON_SECRET → эндпоинт
// ОТКЛЮЧЁН (403), чтобы его нельзя было дёрнуть открыто. На проде дёргается
// systemd-таймером с секретом, 03:30 MSK (вне окна RSVP-напоминаний в 09:00).
export const dynamic = 'force-dynamic'

const handle = async (req: Request): Promise<Response> => {
  const secret = process.env.CRON_SECRET
  if (!secret) return NextResponse.json({ ok: false, reason: 'disabled' }, { status: 403 })
  const provided = new URL(req.url).searchParams.get('secret') ?? req.headers.get('x-cron-secret')
  if (provided !== secret) return NextResponse.json({ ok: false }, { status: 401 })

  try {
    const payload = await getPayload({ config })
    const res = await seedDemo(payload)
    payload.logger.info(`[cron/demo-reseed] branch=${res.branchId} counts=${JSON.stringify(res.counts)}`)
    return NextResponse.json({ ok: true, ...res })
  } catch (err) {
    // Детали ошибки — только в лог (не наружу): могли бы утечь структуру данных.
    console.error('[cron/demo-reseed]', err)
    return NextResponse.json({ ok: false }, { status: 500 })
  }
}

export const GET = handle
export const POST = handle
