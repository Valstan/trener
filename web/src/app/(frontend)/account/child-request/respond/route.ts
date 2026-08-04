import config from '@payload-config'
import { getPayload } from 'payload'
import { NextResponse } from 'next/server'

import { isParent } from '@/access/roles'
import { relId } from '@/lib/relId'

export const POST = async (req: Request): Promise<Response> => {
  const payload = await getPayload({ config }); const { user } = await payload.auth({ headers: req.headers })
  if (!user || !isParent(user)) return NextResponse.json({ ok: false }, { status: 403 })
  const body = await req.json().catch(() => null) as { requestId?: unknown; accept?: unknown } | null
  const requestId = Number(body?.requestId)
  if (!Number.isInteger(requestId) || typeof body?.accept !== 'boolean') return NextResponse.json({ ok: false }, { status: 400 })
  const found = await payload.find({ collection: 'child-registrations', where: { and: [{ id: { equals: requestId } }, { proposedParent: { equals: user.id } }, { status: { equals: 'parent_review' } }] }, limit: 1, depth: 0, overrideAccess: true })
  const request = found.docs[0]
  if (!request) return NextResponse.json({ ok: false }, { status: 404 })
  if (!body.accept) { await payload.update({ collection: 'child-registrations', id: request.id, data: { status: 'rejected' }, overrideAccess: true }); return NextResponse.json({ ok: true }) }
  try {
    await payload.create({ collection: 'players', data: { name: request.childName, dateOfBirth: request.dateOfBirth, parent: user.id, account: relId(request.account)!, branch: relId(request.branch) ?? relId(user.branch) ?? undefined }, overrideAccess: true })
    await payload.update({ collection: 'users', id: relId(request.account)!, data: { roles: ['child'], requestedRole: 'child', status: 'approved', branch: relId(request.branch) ?? relId(user.branch) ?? undefined }, overrideAccess: true })
    await payload.update({ collection: 'child-registrations', id: request.id, data: { status: 'accepted' }, overrideAccess: true })
    return NextResponse.json({ ok: true })
  } catch { return NextResponse.json({ ok: false }, { status: 409 }) }
}
