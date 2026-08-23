import config from '@payload-config'
import { getPayload } from 'payload'
import { NextResponse } from 'next/server'

import { adminBranchId, isOwner, isParent } from '@/access/roles'
import { apiErrorResponse } from '@/lib/apiErrorResponse'
import { relId } from '@/lib/relId'

export const POST = async (req: Request): Promise<Response> => {
  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers: req.headers })
  if (!user) return NextResponse.json({ ok: false }, { status: 401 })
  const raw = (await req.json().catch(() => null)) as { threadId?: unknown; branchId?: unknown; body?: unknown } | null
  const body = typeof raw?.body === 'string' ? raw.body.trim().slice(0, 2000) : ''
  if (!body) return NextResponse.json({ ok: false }, { status: 400 })

  let threadId = Number(raw?.threadId)
  let thread = Number.isInteger(threadId)
    ? await payload.findByID({ collection: 'payment-threads', id: threadId, depth: 0, user, overrideAccess: false }).catch(() => null)
    : null

  if (isParent(user) && !thread) {
    const branchId = Number(raw?.branchId)
    if (!Number.isInteger(branchId)) return NextResponse.json({ ok: false }, { status: 400 })
    const children = await payload.find({ collection: 'players', where: { parent: { equals: user.id } }, depth: 1, limit: 100, overrideAccess: true })
    const ownsBranch = children.docs.some((child) => {
      const group = typeof child.group === 'object' ? child.group : null
      return relId(group?.branch) === branchId
    })
    if (!ownsBranch) return NextResponse.json({ ok: false }, { status: 403 })
    const existing = await payload.find({ collection: 'payment-threads', where: { and: [{ parent: { equals: user.id } }, { branch: { equals: branchId } }] }, depth: 0, limit: 1, overrideAccess: true })
    // user — иначе demoGuestLimit хук не увидит демо-автора и лимит 5 не сработает (C2).
    try {
      thread = existing.docs[0] ?? await payload.create({ collection: 'payment-threads', data: { parent: user.id, branch: branchId, lastMessageAt: new Date().toISOString() }, user, overrideAccess: true })
    } catch (err) {
      // Публичная ошибка Payload (лимит демо D-029) — отдаём её текст и статус форме.
      const known = apiErrorResponse(err)
      if (known) return known
      throw err
    }
    threadId = thread.id
  }

  // Бухгалтерия = владелец ИЛИ админ филиала (нить его филиала — гейт держит
  // scoped read выше: findByID под ролью не отдаст чужую нить).
  const isStaff = isOwner(user) || adminBranchId(user) != null
  if (!thread || !(isParent(user) || isStaff)) return NextResponse.json({ ok: false }, { status: 403 })
  const now = new Date().toISOString()
  // authorName: имя, а не email — email сотрудника попадал в НЕИЗМЕНЯЕМОЕ
  // сообщение, видимое родителю, у любого сотрудника без имени.
  const authorName = user.name?.trim() || (isStaff ? 'Бухгалтерия школы' : 'Родитель')
  await payload.create({ collection: 'payment-messages', data: { thread: threadId, author: user.id, authorName, authorRole: isStaff ? 'staff' : 'parent', body }, user, overrideAccess: true })
  await payload.update({ collection: 'payment-threads', id: threadId, data: { lastMessageAt: now }, overrideAccess: true })
  return NextResponse.json({ ok: true, threadId })
}
