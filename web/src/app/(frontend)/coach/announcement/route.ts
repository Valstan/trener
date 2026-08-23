import config from '@payload-config'
import { getPayload } from 'payload'
import { NextResponse } from 'next/server'

import { apiErrorResponse } from '@/lib/apiErrorResponse'

import { adminBranchId, isCoach, isFullOwner, isOwner } from '@/access/roles'
import { staffCanManageGroup } from '@/lib/groupScope'

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

    // Охват (M5 PR-C): сеть и закреп — только ЖИВОЙ владелец; филиал — живой владелец любой,
    // admin/демо-владелец — только свой (adminBranchId); тренеру — группа как раньше.
    // `isOwner` здесь пропускал демо-владельца к живым филиалам (D-029/#166, 23.08).
    const scopeStr = scope === 'branch' || scope === 'network' ? scope : 'group'
    const fullOwner = isFullOwner(user)
    if ((scopeStr === 'network' || pinned === true) && !fullOwner) {
      return NextResponse.json({ ok: false }, { status: 403 })
    }
    const branchList =
      scopeStr === 'branch'
        ? (Array.isArray(branchIds) ? branchIds : []).filter((b): b is number => typeof b === 'number')
        : []
    if (scopeStr === 'branch' && !branchList.length) {
      return NextResponse.json({ ok: false }, { status: 400 })
    }
    if (scopeStr === 'branch' && !fullOwner) {
      const myBranch = adminBranchId(user)
      if (myBranch == null || branchList.some((b) => String(b) !== String(myBranch))) {
        return NextResponse.json({ ok: false }, { status: 403 })
      }
    }
    if (scopeStr === 'group' && typeof groupId !== 'number') {
      return NextResponse.json({ ok: false }, { status: 400 })
    }

    // Владение группой — лестница lib/groupScope (живой владелец — любая; admin и
    // демо-владелец — свой филиал; тренер — свои).
    if (scopeStr === 'group' && !(await staffCanManageGroup(payload, user, groupId as number))) {
      return NextResponse.json({ ok: false }, { status: 403 })
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
