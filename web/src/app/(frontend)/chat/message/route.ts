import config from '@payload-config'
import { getPayload } from 'payload'
import { NextResponse } from 'next/server'

import { adminBranchId, isCoach, isOwner } from '@/access/roles'
import { parseMessageCreate } from '@/lib/chatInput'
import { relId } from '@/lib/relId'

// POST { topicId, body } → реплика в тему (M9). Писать может любой участник группы,
// включая родителя, поэтому create в коллекции закрыт наглухо, а участие проверяется
// здесь — попыткой ПРОЧИТАТЬ тему под ролью автора (overrideAccess:false). Не нашлось —
// значит не участник; 404 без различения «нет темы» и «не твоя» (анти-enumeration).
export const dynamic = 'force-dynamic'

export const POST = async (req: Request): Promise<Response> => {
  try {
    const payload = await getPayload({ config })
    const { user } = await payload.auth({ headers: req.headers })
    if (!user) return NextResponse.json({ ok: false }, { status: 401 })

    let raw: unknown = null
    try {
      raw = await req.json()
    } catch {
      // ниже 400
    }
    const input = parseMessageCreate(raw)
    if (!input) return NextResponse.json({ ok: false }, { status: 400 })

    let topic
    try {
      topic = await payload.findByID({
        collection: 'chat-topics',
        id: input.topicId,
        depth: 0,
        user,
        overrideAccess: false,
      })
    } catch {
      return NextResponse.json({ ok: false }, { status: 404 })
    }
    if (!topic) return NextResponse.json({ ok: false }, { status: 404 })
    if (topic.closed) return NextResponse.json({ ok: false, reason: 'closed' }, { status: 409 })

    const groupId = relId(topic.group)
    if (groupId == null) return NextResponse.json({ ok: false }, { status: 409 })

    const authorRole = isOwner(user) || adminBranchId(user) != null ? 'staff' : isCoach(user) ? 'coach' : 'parent'

    await payload.create({
      collection: 'chat-messages',
      data: {
        topic: topic.id,
        group: groupId,
        author: user.id,
        // Снимок имени: аккаунт удалят — переписка останется читаемой.
        authorName: user.name || user.email,
        authorRole,
        body: input.body,
      },
      overrideAccess: true,
    })

    // Сортировка тем — по свежести. Пишем служебно (overrideAccess): родитель не
    // имеет права update на тему, но его сообщение обязано её поднять.
    await payload.update({
      collection: 'chat-topics',
      id: topic.id,
      data: { lastMessageAt: new Date().toISOString() },
      overrideAccess: true,
    })

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[chat/message POST]', err)
    return NextResponse.json({ ok: false }, { status: 500 })
  }
}
