import config from '@payload-config'
import { getPayload } from 'payload'
import { NextResponse } from 'next/server'

import { isChild, isCoach, isOwner, isParent } from '@/access/roles'
import { relId } from '@/lib/relId'

export const POST = async (req: Request): Promise<Response> => {
  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers: req.headers })
  if (!user) return NextResponse.json({ ok: false }, { status: 401 })
  const raw = await req.json().catch(() => null) as { matchId?: unknown; body?: unknown } | null
  const matchId = typeof raw?.matchId === 'number' && Number.isInteger(raw.matchId) ? raw.matchId : null
  const body = typeof raw?.body === 'string' ? raw.body.trim().slice(0, 2000) : ''
  if (!matchId || !body) return NextResponse.json({ ok: false }, { status: 400 })
  try {
    const match = await payload.findByID({ collection: 'matches', id: matchId, depth: 0, user, overrideAccess: false })
    const authorRole = isOwner(user) ? 'staff' : isCoach(user) ? 'coach' : isParent(user) ? 'parent' : isChild(user) ? 'child' : null
    if (!authorRole) return NextResponse.json({ ok: false }, { status: 403 })
    await payload.create({ collection: 'match-comments', data: { match: match.id, group: relId(match.group)!, author: user.id, authorName: user.name || 'Участник', authorRole, body }, overrideAccess: true })
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ ok: false }, { status: 403 })
  }
}
