import config from '@payload-config'
import { getPayload } from 'payload'
import { NextResponse } from 'next/server'

import { isOwner, isParent } from '@/access/roles'
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
    thread = existing.docs[0] ?? await payload.create({ collection: 'payment-threads', data: { parent: user.id, branch: branchId, lastMessageAt: new Date().toISOString() }, overrideAccess: true })
    threadId = thread.id
  }

  if (!thread || !(isParent(user) || isOwner(user))) return NextResponse.json({ ok: false }, { status: 403 })
  const now = new Date().toISOString()
  await payload.create({ collection: 'payment-messages', data: { thread: threadId, author: user.id, authorName: user.name || user.email, authorRole: isOwner(user) ? 'staff' : 'parent', body }, overrideAccess: true })
  await payload.update({ collection: 'payment-threads', id: threadId, data: { lastMessageAt: now }, overrideAccess: true })
  return NextResponse.json({ ok: true, threadId })
}
