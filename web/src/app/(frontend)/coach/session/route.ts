import config from '@payload-config'
import { getPayload } from 'payload'
import { NextResponse } from 'next/server'

import { isOwner, isCoach } from '@/access/roles'
import { apiErrorResponse } from '@/lib/apiErrorResponse'
import { buildSessionsCreatedMessage } from '@/lib/push/message'
import { sendPushToUser } from '@/lib/push/send'
import { relId } from '@/lib/relId'
import { MAX_OCCURRENCES } from '@/lib/repeatSchedule'
import { parseSessionBatch, parseSessionCreate, parseSessionPatch } from '@/lib/sessionInput'

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
    if (!user || !(isCoach(user) || isOwner(user))) return NextResponse.json({ ok: false }, { status: 401 })

    let raw: unknown = null
    try {
      raw = await req.json()
    } catch {
      // ниже 400
    }
    // Форма с повторами шлёт `occurrences[]`; одиночное создание — прежний контракт.
    const hasOccurrences =
      typeof raw === 'object' && raw !== null && Array.isArray((raw as Record<string, unknown>).occurrences)
    const single = hasOccurrences ? null : parseSessionCreate(raw)
    const batch = hasOccurrences ? parseSessionBatch(raw, MAX_OCCURRENCES) : null
    const input = batch ?? (single ? { ...single, occurrences: [{ startDate: single.startDate, endDate: single.endDate }] } : null)
    if (!input) return NextResponse.json({ ok: false }, { status: 400 })

    if (!isOwner(user)) {
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

    // Последовательно, а не Promise.all: сотня параллельных create на одном ядре
    // Бокса 1 — ровно тот спайк, которого мы избегаем (аудит 30.07 §3).
    for (const occ of input.occurrences) {
      await payload.create({
        collection: 'training-sessions',
        data: {
          group: input.groupId,
          startDate: occ.startDate,
          endDate: occ.endDate,
          location: input.location,
          note: input.note,
          status: 'planned',
        },
        // user — иначе demoGuestLimit хук не увидит демо-автора и лимит 5 не сработает (C2).
        user,
        overrideAccess: true,
      })
    }

    // Пуш «в расписании появились тренировки» — ОДИН на запрос, а не на занятие:
    // хук на create слал бы до 120 пушей за один клик по форме с повторами.
    // Push-only, без Notification: ack-очередь остаётся у изменений (ров M2).
    // Best-effort — сбой рассылки не отменяет уже созданные занятия.
    try {
      const players = await payload.find({
        collection: 'players',
        where: { group: { equals: input.groupId } },
        depth: 0,
        limit: 1000,
        pagination: false,
        overrideAccess: true,
      })
      const parents = [
        ...new Set(players.docs.map((p) => relId(p.parent)).filter((v): v is number => v != null)),
      ]
      const message = buildSessionsCreatedMessage(input.occurrences.length)
      for (const parentId of parents) await sendPushToUser(payload, parentId, message).catch(() => {})
      payload.logger.info(
        `[coach/session] group ${input.groupId}: создано ${input.occurrences.length}, пуш ${parents.length} родителям`,
      )
    } catch (err) {
      payload.logger.error({ err, groupId: input.groupId }, '[coach/session] пуш о новых тренировках не отправлен')
    }

    return NextResponse.json({ ok: true, created: input.occurrences.length })
  } catch (err) {
    console.error('[coach/session POST]', err)
    // Публичная ошибка Payload (лимит демо D-029) — отдаём её текст и статус форме.
    const known = apiErrorResponse(err)
    if (known) return known
    return NextResponse.json({ ok: false }, { status: 500 })
  }
}

export const PATCH = async (req: Request): Promise<Response> => {
  try {
    const payload = await getPayload({ config })
    const { user } = await payload.auth({ headers: req.headers })
    if (!user || !(isCoach(user) || isOwner(user))) return NextResponse.json({ ok: false }, { status: 401 })

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
