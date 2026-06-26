import config from '@payload-config'
import { getPayload } from 'payload'
import { NextResponse } from 'next/server'

import { isAdmin, isCoach } from '@/access/roles'

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
    if (!user || !(isCoach(user) || isAdmin(user))) return NextResponse.json({ ok: false }, { status: 401 })

    let groupId: unknown
    let title: unknown
    let body: unknown
    let triggersPush: unknown
    try {
      const parsed = (await req.json()) as {
        groupId?: unknown
        title?: unknown
        body?: unknown
        triggersPush?: unknown
      }
      groupId = parsed?.groupId
      title = parsed?.title
      body = parsed?.body
      triggersPush = parsed?.triggersPush
    } catch {
      // ниже 400
    }

    const titleStr = typeof title === 'string' ? title.trim() : ''
    const bodyStr = typeof body === 'string' ? body.trim() : ''
    if (typeof groupId !== 'number' || !titleStr || !bodyStr) {
      return NextResponse.json({ ok: false }, { status: 400 })
    }

    // Владение: тренер — только своя группа; админ — любая.
    if (!isAdmin(user)) {
      const owned = await payload.find({
        collection: 'groups',
        where: { and: [{ id: { equals: groupId } }, { coaches: { in: [user.id] } }] },
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
        group: groupId,
        title: titleStr,
        body: bodyStr,
        triggersPush: triggersPush === true,
        publishedAt: new Date().toISOString(),
      },
      overrideAccess: true,
    })

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[coach/announcement]', err)
    return NextResponse.json({ ok: false }, { status: 500 })
  }
}
