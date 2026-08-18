import config from '@payload-config'
import { getPayload } from 'payload'
import { NextResponse } from 'next/server'

import { apiErrorResponse } from '@/lib/apiErrorResponse'

import { isOwner, isCoach } from '@/access/roles'

// POST { groupId, title, body, triggersPush? } → объявление тренера группе (M3-PR10).
// #015: тренер шлёт ТОЛЬКО в свои группы (проверяем владение: группа.coaches ∋ user).
// Создаём через local API с overrideAccess (автор/публикация — server-set, не из
// клиента); afterChange-хук (fanOutAnnouncement) делает best-effort пуш при triggersPush.
// server-mediated, как /parent/rsvp.
export const dynamic = 'force-dynamic'

export const POST = async (req: Request): Promise<Response> => {
  try {
    const payload = await getPayload({ config })
    const { user } = await payload.auth({ headers: req.headers })
    if (!user || !(isCoach(user) || isOwner(user))) return NextResponse.json({ ok: false }, { status: 401 })

    let groupId: unknown
    let title: unknown
    let body: unknown
    let triggersPush: unknown
    let scope: unknown
    let branchIds: unknown
    let pinned: unknown
    try {
      const parsed = (await req.json()) as {
        groupId?: unknown
        title?: unknown
        body?: unknown
        triggersPush?: unknown
        scope?: unknown
        branchIds?: unknown
        pinned?: unknown
      }
      groupId = parsed?.groupId
      title = parsed?.title
      body = parsed?.body
      triggersPush = parsed?.triggersPush
      scope = parsed?.scope
      branchIds = parsed?.branchIds
      pinned = parsed?.pinned
    } catch {
      // ниже 400
    }

    const titleStr = typeof title === 'string' ? title.trim() : ''
    const bodyStr = typeof body === 'string' ? body.trim() : ''
    if (!titleStr || !bodyStr) return NextResponse.json({ ok: false }, { status: 400 })

    // Охват (M5 PR-C): сеть/филиалы — только владелец; тренеру — группа как раньше.
    const scopeStr = scope === 'branch' || scope === 'network' ? scope : 'group'
    if ((scopeStr !== 'group' || pinned === true) && !isOwner(user)) {
      return NextResponse.json({ ok: false }, { status: 403 })
    }
    const branchList =
      scopeStr === 'branch'
        ? (Array.isArray(branchIds) ? branchIds : []).filter((b): b is number => typeof b === 'number')
        : []
    if (scopeStr === 'branch' && !branchList.length) {
      return NextResponse.json({ ok: false }, { status: 400 })
    }
    if (scopeStr === 'group' && typeof groupId !== 'number') {
      return NextResponse.json({ ok: false }, { status: 400 })
    }

    // Владение: тренер — только своя группа; владелец — любая.
    if (scopeStr === 'group' && !isOwner(user)) {
      const owned = await payload.find({
        collection: 'groups',
        where: { and: [{ id: { equals: groupId as number } }, { coaches: { in: [user.id] } }] },
        limit: 1,
        depth: 0,
        pagination: false,
        overrideAccess: true,
      })
      if (!owned.docs.length) return NextResponse.json({ ok: false }, { status: 403 })
    }

    await payload.create({
      collection: 'announcements',
      data: {
        author: user.id,
        scope: scopeStr,
        group: scopeStr === 'group' ? (groupId as number) : null,
        branches: branchList.length ? branchList : null,
        pinned: pinned === true,
        title: titleStr,
        body: bodyStr,
        triggersPush: triggersPush === true,
        publishedAt: new Date().toISOString(),
      },
      overrideAccess: true,
      // user прокидывается в req.user хуков — guardScope (beforeValidate) сверяет
      // владельца и под overrideAccess.
      user,
    })

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[coach/announcement]', err)
    // Публичная ошибка Payload (лимит демо D-029) — отдаём её текст и статус форме.
    const known = apiErrorResponse(err)
    if (known) return known
    return NextResponse.json({ ok: false }, { status: 500 })
  }
}
