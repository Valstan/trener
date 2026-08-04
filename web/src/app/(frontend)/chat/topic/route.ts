import config from '@payload-config'
import { getPayload } from 'payload'
import { NextResponse } from 'next/server'

import { parseTopicCreate } from '@/lib/chatInput'
import { allowedChatTargets } from '@/access/chatScope'

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
      const permitted = input.scope === 'school' ? allowed.school : input.scope === 'branch' ? input.branchId != null && allowed.branches.map(String).includes(String(input.branchId)) : input.groupId != null && (allowed.school || allowed.groups.map(String).includes(String(input.groupId)))
      if (!permitted) return NextResponse.json({ ok: false }, { status: 403 })
      const topic = await payload.create({
        collection: 'chat-topics',
        data: { title: input.title, scope: input.scope, ...(input.groupId != null ? { group: input.groupId } : {}), ...(input.branchId != null ? { branch: input.branchId } : {}), room: input.room, createdBy: user.id },
        overrideAccess: true,
      })
      return NextResponse.json({ ok: true, id: topic.id })
    } catch {
      // Нет прав ИЛИ нет такой группы — не различаем (анти-enumeration, как /parent/ack).
      return NextResponse.json({ ok: false }, { status: 403 })
    }
  } catch (err) {
    console.error('[chat/topic POST]', err)
    return NextResponse.json({ ok: false }, { status: 500 })
  }
}
