import config from '@payload-config'
import { NextResponse } from 'next/server'
import type { PayloadRequest } from 'payload'
import { getPayload } from 'payload'

import { adminBranchId, branchGroupIds, isOwner } from '@/access/roles'

// POST { playerId, paidUntil, paidFrom?, amount?, note? } → запись абонемента (M8).
// Ведут владелец и админ филиала (только дети групп его филиала). Продление =
// новая запись (журнал), server-mediated как остальные write-пути.
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

    // Скоуп админа филиала: ребёнок должен быть в группе его филиала.
    if (!isOwner(user) && branch != null) {
      const groupIds = await branchGroupIds({ payload } as unknown as PayloadRequest, branch)
      const owned = groupIds.length
        ? await payload.find({
            collection: 'players',
            where: { and: [{ id: { equals: playerId } }, { group: { in: groupIds } }] },
            limit: 1,
            depth: 0,
            pagination: false,
            overrideAccess: true,
          })
        : { docs: [] }
      if (!owned.docs.length) return NextResponse.json({ ok: false }, { status: 403 })
    }

    await payload.create({
      collection: 'subscriptions',
      data: {
        player: playerId,
        paidUntil,
        paidFrom: typeof parsed.paidFrom === 'string' && parsed.paidFrom ? parsed.paidFrom : null,
        amount: typeof parsed.amount === 'number' && parsed.amount >= 0 ? parsed.amount : null,
        note: typeof parsed.note === 'string' ? parsed.note.trim().slice(0, 200) || null : null,
      },
      overrideAccess: true,
      user,
    })

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[coach/payment]', err)
    return NextResponse.json({ ok: false }, { status: 500 })
  }
}
