import config from '@payload-config'
import { getPayload } from 'payload'
import { NextResponse } from 'next/server'

import { apiErrorResponse } from '@/lib/apiErrorResponse'
import { parseTopicCreate } from '@/lib/chatInput'
import { canCreateTopic } from '@/lib/chatTopicScope'
import { allowedChatTargets } from '@/access/chatScope'
import { isFullOwner } from '@/access/roles'

// POST { groupId, title } → новая тема в комнате группы (M9).
//
// #015-владение проверяем не флагом роли, а попыткой создать ПОД ролью вызывающего
// (user + overrideAccess:false): гейт adminOrCoachOwnGroup коллекции сам решит, своя
// ли это группа тренеру и свой ли филиал админу. Дублировать это условие здесь — верный
// способ получить две расходящиеся копии правила.
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
    const input = parseTopicCreate(raw)
    if (!input) return NextResponse.json({ ok: false }, { status: 400 })

    try {
      const allowed = await allowedChatTargets({ payload, user } as never)
      // Матрица роль×scope — чистая canCreateTopic (см. её комментарий про дыру
      // `allowed.school ||`). Гейт «своя группа у тренера» ещё жёстче и срабатывает
      // в guardTopicGroup — для этого в create передаём user (без него хук слеп).
      const permitted = canCreateTopic({ owner: isFullOwner(user), ...allowed }, input)
      if (!permitted) return NextResponse.json({ ok: false }, { status: 403 })
      const topic = await payload.create({
        collection: 'chat-topics',
        data: { title: input.title, scope: input.scope, ...(input.groupId != null ? { group: input.groupId } : {}), ...(input.branchId != null ? { branch: input.branchId } : {}), room: input.room, createdBy: user.id },
        overrideAccess: true,
        user,
      })
      return NextResponse.json({ ok: true, id: topic.id })
    } catch (err) {
      // Публичная ошибка Payload (лимит демо D-029) — отдаём её текст и статус форме.
      const known = apiErrorResponse(err)
      if (known) return known
      // Нет прав ИЛИ нет такой группы — не различаем (анти-enumeration, как /parent/ack).
      return NextResponse.json({ ok: false }, { status: 403 })
    }
  } catch (err) {
    console.error('[chat/topic POST]', err)
    return NextResponse.json({ ok: false }, { status: 500 })
  }
}
