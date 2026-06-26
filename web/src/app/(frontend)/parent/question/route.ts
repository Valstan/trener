import config from '@payload-config'
import { getPayload } from 'payload'
import { NextResponse } from 'next/server'

import { isParent } from '@/access/roles'
import { relId } from '@/lib/relId'

// POST { groupId, body, sessionId? } → вопрос родителя тренеру (M3-PR11, суррогат чата).
// #015: родитель спрашивает ТОЛЬКО по группе, где есть его ребёнок (проверяем владение).
// create через local API с overrideAccess (автор/статус — server-set); afterChange-хук
// (fanOutQuestion) делает best-effort пуш тренерам группы. server-mediated, как /parent/rsvp.
export const dynamic = 'force-dynamic'

export const POST = async (req: Request): Promise<Response> => {
  try {
    const payload = await getPayload({ config })
    const { user } = await payload.auth({ headers: req.headers })
    if (!user || !isParent(user)) return NextResponse.json({ ok: false }, { status: 401 })

    let groupId: unknown
    let body: unknown
    let sessionId: unknown
    try {
      const parsed = (await req.json()) as { groupId?: unknown; body?: unknown; sessionId?: unknown }
      groupId = parsed?.groupId
      body = parsed?.body
      sessionId = parsed?.sessionId
    } catch {
      // ниже 400
    }

    const bodyStr = typeof body === 'string' ? body.trim() : ''
    if (typeof groupId !== 'number' || !bodyStr) {
      return NextResponse.json({ ok: false }, { status: 400 })
    }

    // Владение: у родителя есть ребёнок в этой группе.
    const owned = await payload.find({
      collection: 'players',
      where: { and: [{ parent: { equals: user.id } }, { group: { equals: groupId } }] },
      limit: 1,
      depth: 0,
      pagination: false,
      overrideAccess: true,
    })
    if (!owned.docs.length) return NextResponse.json({ ok: false }, { status: 403 })

    // Опц. контекст-сессия: принимаем, только если она из этой же группы.
    let sessionRel: number | undefined
    if (typeof sessionId === 'number') {
      const s = await payload
        .findByID({ collection: 'training-sessions', id: sessionId, depth: 0, overrideAccess: true })
        .catch(() => null)
      if (s && relId(s.group) === groupId) sessionRel = sessionId
    }

    await payload.create({
      collection: 'questions',
      data: {
        parent: user.id,
        group: groupId,
        ...(sessionRel != null ? { session: sessionRel } : {}),
        body: bodyStr,
        status: 'new',
      },
      overrideAccess: true,
    })

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[parent/question]', err)
    return NextResponse.json({ ok: false }, { status: 500 })
  }
}
