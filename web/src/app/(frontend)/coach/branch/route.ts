import config from '@payload-config'
import { NextResponse } from 'next/server'
import { getPayload } from 'payload'

import { isOwner } from '@/access/roles'
import { BRANCH_CTX_COOKIE } from '@/lib/branchContext'

// POST { branchId: number | null } → выбор контекста филиала владельцем (M5 PR-D).
// null/невалидное = сброс («все филиалы»). Только owner: у остальных ролей скоуп
// задаётся authz, а не cookie.
export const dynamic = 'force-dynamic'

export const POST = async (req: Request): Promise<Response> => {
  try {
    const payload = await getPayload({ config })
    const { user } = await payload.auth({ headers: req.headers })
    if (!user || !isOwner(user)) return NextResponse.json({ ok: false }, { status: 401 })

    let branchId: unknown
    try {
      branchId = ((await req.json()) as { branchId?: unknown })?.branchId
    } catch {
      // сброс ниже
    }

    const res = NextResponse.json({ ok: true })
    if (typeof branchId === 'number' && Number.isInteger(branchId) && branchId > 0) {
      res.cookies.set(BRANCH_CTX_COOKIE, String(branchId), {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        maxAge: 60 * 60 * 24 * 365,
      })
    } else {
      res.cookies.set(BRANCH_CTX_COOKIE, '', { path: '/', maxAge: 0 })
    }
    return res
  } catch (err) {
    console.error('[coach/branch]', err)
    return NextResponse.json({ ok: false }, { status: 500 })
  }
}
