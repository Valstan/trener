import config from '@payload-config'
import { getPayload } from 'payload'
import { NextResponse } from 'next/server'

import { isOwner, isParent } from '@/access/roles'
import { relId } from '@/lib/relId'

export const POST = async (req: Request): Promise<Response> => {
  const payload = await getPayload({ config }); const { user } = await payload.auth({ headers: req.headers })
  if (!user || !isOwner(user)) return NextResponse.json({ ok: false }, { status: 403 })
  const body = await req.json().catch(() => null) as { requestId?: unknown; parentId?: unknown } | null
  const requestId = Number(body?.requestId); const parentId = Number(body?.parentId)
  if (!Number.isInteger(requestId) || !Number.isInteger(parentId)) return NextResponse.json({ ok: false }, { status: 400 })
  try {
    const [parent, registration] = await Promise.all([
      payload.findByID({ collection: 'users', id: parentId, depth: 0, overrideAccess: true }),
      payload.findByID({ collection: 'child-registrations', id: requestId, depth: 0, overrideAccess: true }),
    ])
    if (!isParent(parent) || parent.status !== 'approved') return NextResponse.json({ ok: false }, { status: 400 })
    if (registration.status !== 'owner_review') return NextResponse.json({ ok: false }, { status: 409 })
    const branchId = relId(parent.branch)
    if (!branchId) return NextResponse.json({ error: 'Сначала назначьте родителю филиал' }, { status: 400 })
    await payload.update({ collection: 'child-registrations', id: requestId, data: { proposedParent: parent.id, branch: branchId, status: 'parent_review' }, overrideAccess: true })
    return NextResponse.json({ ok: true })
  } catch { return NextResponse.json({ ok: false }, { status: 404 }) }
}
