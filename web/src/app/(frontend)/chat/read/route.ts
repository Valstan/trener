import config from '@payload-config'
import { getPayload } from 'payload'
import { NextResponse } from 'next/server'

import { markTopicRead } from '@/lib/chatRead'

// POST { topicId } → «прочитал тему до сейчас» (M9). Идемпотентно: у пары
// (участник × тема) одна запись, повторный вызов двигает момент вперёд.
//
// Участие проверяем чтением темы ПОД ролью (overrideAccess:false) — не участник
// не отметит прочтение чужой темы. Сама запись служебная, пишется overrideAccess:
// у пользователя нет права create на chat-reads, и это правильно — иначе он мог бы
// подделать отметку за другого.
export const dynamic = 'force-dynamic'

export const POST = async (req: Request): Promise<Response> => {
  try {
    const payload = await getPayload({ config })
    const { user } = await payload.auth({ headers: req.headers })
    if (!user) return NextResponse.json({ ok: false }, { status: 401 })

    let topicId: unknown = null
    try {
      topicId = ((await req.json()) as { topicId?: unknown }).topicId
    } catch {
      // ниже 400
    }
    if (typeof topicId !== 'number' || !Number.isInteger(topicId) || topicId <= 0) {
      return NextResponse.json({ ok: false }, { status: 400 })
    }

    try {
      await payload.findByID({
        collection: 'chat-topics',
        id: topicId,
        depth: 0,
        user,
        overrideAccess: false,
      })
    } catch {
      return NextResponse.json({ ok: false }, { status: 404 })
    }

    await markTopicRead(payload, user.id, topicId)

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[chat/read POST]', err)
    return NextResponse.json({ ok: false }, { status: 500 })
  }
}
