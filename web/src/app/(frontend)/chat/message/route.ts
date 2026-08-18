import config from '@payload-config'
import { getPayload } from 'payload'
import { NextResponse } from 'next/server'

import { adminBranchId, isChild, isCoach, isOwner } from '@/access/roles'
import { apiErrorResponse } from '@/lib/apiErrorResponse'
import { parseMessageCreate } from '@/lib/chatInput'
import { markTopicRead } from '@/lib/chatRead'
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
    const branchId = relId(topic.branch)

    const authorRole = isOwner(user) || adminBranchId(user) != null ? 'staff' : isCoach(user) ? 'coach' : isChild(user) ? 'child' : 'parent'

    await payload.create({
      collection: 'chat-messages',
      data: {
        topic: topic.id,
        ...(groupId != null ? { group: groupId } : {}),
        ...(branchId != null ? { branch: branchId } : {}),
        scope: topic.scope ?? 'group',
        room: topic.room ?? 'adults',
        author: user.id,
        // Снимок имени: аккаунт удалят — переписка останется читаемой.
        authorName: user.name || user.email,
        authorRole,
        body: input.body,
      },
      // user — иначе demoGuestLimit хук (req.user.demo) не увидит демо-автора и лимит
      // 5 сущностей на витринного посетителя не сработает (C2).
      user,
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

    // Своя реплика не должна гореть у автора как непрочитанная — она же и подняла
    // lastMessageAt. Без этого индикатору перестают верить с первого же сообщения.
    await markTopicRead(payload, user.id, topic.id)

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[chat/message POST]', err)
    // Публичная ошибка Payload (лимит демо D-029) — отдаём её текст и статус форме.
    const known = apiErrorResponse(err)
    if (known) return known
    return NextResponse.json({ ok: false }, { status: 500 })
  }
}
