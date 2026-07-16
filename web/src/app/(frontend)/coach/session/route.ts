import config from '@payload-config'
import { getPayload } from 'payload'
import { NextResponse } from 'next/server'

import { isAdmin, isCoach } from '@/access/roles'
import { parseSessionCreate, parseSessionPatch } from '@/lib/sessionInput'

// Фронтовый composer расписания (дорожная карта после #64): тренер заводит/правит/
// отменяет тренировки без Payload-админки.
//
// POST  { groupId, startDate, endDate?, location?, note? } → новая planned-сессия
//       (создание — не волна, trackSessionChange игнорит operation=create).
// PATCH { sessionId, startDate?, endDate?, location?, note?, cancel? } → правка/отмена;
//       ядро M2 само поднимает волну (diff → status-флип → фан-аут пуш/ack/coverage).
//
// #015-владение: create — ручная проверка «тренер заводит только в свои группы» (как
// /coach/match); update — через payload.update с user+overrideAccess:false, гейт
// adminOrCoachOwnGroup коллекции.
export const dynamic = 'force-dynamic'

export const POST = async (req: Request): Promise<Response> => {
  try {
    const payload = await getPayload({ config })
    const { user } = await payload.auth({ headers: req.headers })
    if (!user || !(isCoach(user) || isAdmin(user))) return NextResponse.json({ ok: false }, { status: 401 })

    let raw: unknown = null
    try {
      raw = await req.json()
    } catch {
      // ниже 400
    }
    const input = parseSessionCreate(raw)
    if (!input) return NextResponse.json({ ok: false }, { status: 400 })

    if (!isAdmin(user)) {
      const owned = await payload.find({
        collection: 'groups',
        where: { and: [{ id: { equals: input.groupId } }, { coaches: { in: [user.id] } }] },
        limit: 1,
        depth: 0,
        pagination: false,
        overrideAccess: true,
      })
      if (!owned.docs.length) return NextResponse.json({ ok: false }, { status: 403 })
    }

    await payload.create({
      collection: 'training-sessions',
      data: {
        group: input.groupId,
        startDate: input.startDate,
        endDate: input.endDate,
        location: input.location,
        note: input.note,
        status: 'planned',
      },
      overrideAccess: true,
    })

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[coach/session POST]', err)
    return NextResponse.json({ ok: false }, { status: 500 })
  }
}

export const PATCH = async (req: Request): Promise<Response> => {
  try {
    const payload = await getPayload({ config })
    const { user } = await payload.auth({ headers: req.headers })
    if (!user || !(isCoach(user) || isAdmin(user))) return NextResponse.json({ ok: false }, { status: 401 })

    let raw: unknown = null
    try {
      raw = await req.json()
    } catch {
      // ниже 400
    }
    const input = parseSessionPatch(raw)
    if (!input) return NextResponse.json({ ok: false }, { status: 400 })

    try {
      await payload.update({
        collection: 'training-sessions',
        id: input.sessionId,
        data: input.data,
        user,
        overrideAccess: false,
      })
    } catch {
      // Not found ИЛИ чужая группа — не различаем (анти-enumeration, как /parent/ack).
      return NextResponse.json({ ok: false }, { status: 404 })
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[coach/session PATCH]', err)
    return NextResponse.json({ ok: false }, { status: 500 })
  }
}
