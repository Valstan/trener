import config from '@payload-config'
import { headers as nextHeaders } from 'next/headers'
import { getPayload } from 'payload'
import { NextResponse } from 'next/server'

import { adminBranchId, coachGroupIds, isCoach, isOwner } from '@/access/roles'
import { relId } from '@/lib/relId'

export const PATCH = async (req: Request): Promise<Response> => {
  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers: await nextHeaders() })
  if (!user) return NextResponse.json({ ok: false }, { status: 401 })
  const body = (await req.json().catch(() => null)) as { playerId?: unknown; groupId?: unknown } | null
  const playerId = Number(body?.playerId)
  const groupId = Number(body?.groupId)
  if (!Number.isInteger(playerId) || !Number.isInteger(groupId)) return NextResponse.json({ ok: false }, { status: 400 })

  let allowed = isOwner(user)
  const branch = adminBranchId(user)
  if (!allowed && branch != null) {
    const group = await payload.findByID({ collection: 'groups', id: groupId, depth: 0, overrideAccess: true })
    allowed = relId(group.branch) === branch
  }
  if (!allowed && isCoach(user)) allowed = (await coachGroupIds({ payload } as never, user.id)).includes(groupId)
  if (!allowed) return NextResponse.json({ ok: false }, { status: 403 })

  try {
    const [player, targetGroup] = await Promise.all([
      payload.findByID({ collection: 'players', id: playerId, depth: 0, user, overrideAccess: false }),
      payload.findByID({ collection: 'groups', id: groupId, depth: 0, overrideAccess: true }),
    ])
    const playerBranch = relId(player.branch)
    const targetBranch = relId(targetGroup.branch)
    if (playerBranch != null && targetBranch !== playerBranch && !isOwner(user)) return NextResponse.json({ ok: false }, { status: 403 })
    await payload.update({ collection: 'players', id: playerId, data: { group: groupId, branch: targetBranch ?? undefined }, overrideAccess: true })
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ ok: false }, { status: 404 })
  }
}
