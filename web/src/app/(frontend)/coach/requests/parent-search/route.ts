import config from '@payload-config'
import { getPayload } from 'payload'
import { NextResponse } from 'next/server'

import { isOwner } from '@/access/roles'
import { relId } from '@/lib/relId'

// GET ?q=<строка> → до 20 подтверждённых родителей по подстроке имени/email.
// Замена выпадашки на 1000 строк в назначении детской заявки: владелец, выбирающий
// родителя вслепую из огромного списка, — это 152-ФЗ-риск отдачи ребёнка не тому.
export const dynamic = 'force-dynamic'

export const GET = async (req: Request): Promise<Response> => {
  try {
    const payload = await getPayload({ config })
    const { user } = await payload.auth({ headers: req.headers })
    if (!user || !isOwner(user)) return NextResponse.json({ ok: false }, { status: 403 })

    const q = (new URL(req.url).searchParams.get('q') ?? '').trim()
    if (q.length < 2) return NextResponse.json({ ok: true, parents: [] })

    const [parents, branches] = await Promise.all([
      payload.find({
        collection: 'users',
        where: {
          and: [
            { roles: { in: ['parent'] } },
            { status: { equals: 'approved' } },
            { or: [{ name: { like: q } }, { email: { like: q } }] },
          ],
        },
        sort: 'name',
        limit: 20,
        depth: 0,
        pagination: false,
        overrideAccess: true,
      }),
      payload.find({ collection: 'branches', limit: 200, depth: 0, pagination: false, overrideAccess: true }),
    ])
    const branchNames = new Map(branches.docs.map((b) => [b.id, b.name]))

    return NextResponse.json({
      ok: true,
      parents: parents.docs.map((p) => {
        const branchId = relId(p.branch)
        return {
          id: p.id,
          name: p.name || p.email,
          branch: branchId != null ? (branchNames.get(Number(branchId)) ?? `Филиал #${branchId}`) : null,
        }
      }),
    })
  } catch (err) {
    console.error('[coach/requests/parent-search]', err)
    return NextResponse.json({ ok: false }, { status: 500 })
  }
}
