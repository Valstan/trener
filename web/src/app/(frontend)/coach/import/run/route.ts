import config from '@payload-config'
import { getPayload } from 'payload'
import { NextResponse } from 'next/server'

import { hasRole } from '@/access/roles'
import type { ImportApplyRowInput } from '@/lib/import/importPlayers'
import { applyImport, previewImport } from '@/lib/import/importPlayers'
import { APPLY_ROW_LIMIT, MAX_IMPORT_TEXT_BYTES } from '@/lib/import/parsePlayersCsv'

// POST — массовый импорт детей (п.6 аудита), два режима одним входом:
//   { mode: 'preview', text, branchId? }            — dry-run, ничего не пишет;
//   { mode: 'apply', rows, branchId?, sendEmails? } — ≤50 строк (чанк с клиента).
// Живёт в /coach/import/run: route.ts не может лежать в одном сегменте с page.tsx
// (ограничение App Router; тот же паттерн, что /coach/staff + /coach/staff/invite).
// Тонкий диспетчер: auth + лимиты, вся логика — в lib/import (скоуп по ролям,
// ре-валидация apply, идемпотентный дедуп). Роли — те же, что создают players
// сегодня, но с обязательной сверкой группы против белого списка вызывающего.
export const dynamic = 'force-dynamic'

export const POST = async (req: Request): Promise<Response> => {
  try {
    const payload = await getPayload({ config })
    const { user } = await payload.auth({ headers: req.headers })
    if (!user) return NextResponse.json({ ok: false }, { status: 401 })
    if (!hasRole(user, 'owner', 'admin', 'coach')) {
      return NextResponse.json({ ok: false }, { status: 403 })
    }

    let body: Record<string, unknown> = {}
    try {
      body = (await req.json()) as Record<string, unknown>
    } catch {
      // ниже 400 input
    }

    const branchId =
      typeof body.branchId === 'number' && Number.isInteger(body.branchId) && body.branchId > 0
        ? body.branchId
        : null

    if (body.mode === 'preview') {
      const text = typeof body.text === 'string' ? body.text : ''
      if (!text.trim()) return NextResponse.json({ ok: false, errorCode: 'input' }, { status: 400 })
      if (Buffer.byteLength(text, 'utf8') > MAX_IMPORT_TEXT_BYTES) {
        return NextResponse.json({ ok: false, errorCode: 'too-large' }, { status: 400 })
      }
      const res = await previewImport(payload, user, { text, branchId })
      if (!res.ok) {
        return NextResponse.json(res, { status: res.errorCode === 'forbidden' ? 403 : 400 })
      }
      // Логи без ПДн (§6): id и счётчики, ни имён, ни email.
      payload.logger.info(
        `[coach/import] user=${user.id} branch=${branchId ?? '-'} preview rows=${res.rows.length} create=${res.summary.create} exists=${res.summary.exists} errors=${res.summary.errors}`,
      )
      return NextResponse.json(res)
    }

    if (body.mode === 'apply') {
      const rows = Array.isArray(body.rows) ? (body.rows as ImportApplyRowInput[]) : []
      if (!rows.length) return NextResponse.json({ ok: false, errorCode: 'input' }, { status: 400 })
      if (rows.length > APPLY_ROW_LIMIT) {
        return NextResponse.json({ ok: false, errorCode: 'too-many-rows' }, { status: 400 })
      }
      const res = await applyImport(payload, user, {
        rows,
        branchId,
        sendEmails: body.sendEmails === true,
      })
      if (!res.ok) {
        return NextResponse.json(res, { status: res.errorCode === 'forbidden' ? 403 : 400 })
      }
      payload.logger.info(
        `[coach/import] user=${user.id} branch=${branchId ?? '-'} apply rows=${rows.length} created=${res.summary.created} links=${res.summary.links} emails=${res.summary.emailsSent} errors=${res.summary.errors}`,
      )
      return NextResponse.json(res)
    }

    return NextResponse.json({ ok: false, errorCode: 'input' }, { status: 400 })
  } catch (err) {
    console.error('[coach/import POST]', err)
    return NextResponse.json({ ok: false }, { status: 500 })
  }
}
