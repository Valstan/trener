import config from '@payload-config'
import { NextResponse } from 'next/server'

import { apiErrorResponse } from '@/lib/apiErrorResponse'
import type { PayloadRequest } from 'payload'
import { getPayload } from 'payload'

import { adminBranchId, branchGroupIds, isOwner } from '@/access/roles'
import { amountValid, paidRangeValid } from '@/lib/paymentInput'

// POST { playerId, paidUntil, paidFrom?, amount?, note? } → запись абонемента (M8).
// Ведут владелец и админ филиала (дети групп филиала И дети филиала без группы —
// раньше безгрупповой ребёнок был виден в форме, а запись по нему отбивалась 403).
// Продление = новая запись (журнал), server-mediated; штамп recordedBy/branch и
// G211-гейт границы — в stampSubscription.
export const dynamic = 'force-dynamic'

export const POST = async (req: Request): Promise<Response> => {
  try {
    const payload = await getPayload({ config })
    const { user } = await payload.auth({ headers: req.headers })
    if (!user) return NextResponse.json({ ok: false }, { status: 401 })

    const branch = adminBranchId(user)
    if (!isOwner(user) && branch == null) return NextResponse.json({ ok: false }, { status: 401 })

    let parsed: {
      playerId?: unknown
      paidUntil?: unknown
      paidFrom?: unknown
      amount?: unknown
      note?: unknown
    } = {}
    try {
      parsed = (await req.json()) as typeof parsed
    } catch {
      // ниже 400
    }

    const playerId = parsed.playerId
    const paidUntil = typeof parsed.paidUntil === 'string' ? parsed.paidUntil : ''
    if (typeof playerId !== 'number' || !paidUntil || Number.isNaN(new Date(paidUntil).getTime())) {
      return NextResponse.json({ ok: false }, { status: 400 })
    }
    const paidFrom = typeof parsed.paidFrom === 'string' && parsed.paidFrom ? parsed.paidFrom : null
    if (!paidRangeValid(paidFrom, paidUntil)) {
      return NextResponse.json({ error: '«Оплачено с» позже «оплачено по»' }, { status: 400 })
    }
    const amount = typeof parsed.amount === 'number' ? parsed.amount : null
    if (!amountValid(amount)) {
      return NextResponse.json({ error: 'Проверьте сумму' }, { status: 400 })
    }

    // Скоуп админа филиала: ребёнок в группе филиала ИЛИ безгрупповой ребёнок филиала.
    if (!isOwner(user) && branch != null) {
      const groupIds = await branchGroupIds({ payload } as unknown as PayloadRequest, branch)
      const owned = await payload.find({
        collection: 'players',
        where: {
          and: [
            { id: { equals: playerId } },
            {
              or: [
                ...(groupIds.length ? [{ group: { in: groupIds } }] : []),
                { branch: { equals: branch } },
              ],
            },
          ],
        },
        limit: 1,
        depth: 0,
        pagination: false,
        overrideAccess: true,
      })
      if (!owned.docs.length) return NextResponse.json({ ok: false }, { status: 403 })
    }

    await payload.create({
      collection: 'subscriptions',
      data: {
        player: playerId,
        paidUntil,
        paidFrom,
        amount: amount != null && amount >= 0 ? amount : null,
        note: typeof parsed.note === 'string' ? parsed.note.trim().slice(0, 200) || null : null,
      },
      overrideAccess: true,
      user,
    })

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[coach/payment]', err)
    // Публичная ошибка Payload (лимит демо D-029) — отдаём её текст и статус форме.
    const known = apiErrorResponse(err)
    if (known) return known
    return NextResponse.json({ ok: false }, { status: 500 })
  }
}
