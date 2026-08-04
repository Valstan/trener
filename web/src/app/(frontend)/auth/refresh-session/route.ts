import config from '@payload-config'
import { getPayload } from 'payload'
import { NextResponse } from 'next/server'

import { homePathForUser } from '@/lib/auth/home'
import { buildAuthCookie } from '@/lib/auth/session'

export const GET = async (req: Request): Promise<Response> => {
  const payload = await getPayload({ config }); const { user } = await payload.auth({ headers: req.headers })
  if (!user) return NextResponse.redirect(new URL('/login', req.url))
  const fresh = await payload.findByID({ collection: 'users', id: user.id, depth: 0, overrideAccess: true })
  const response = NextResponse.redirect(new URL(homePathForUser(fresh), req.url))
  response.headers.set('Set-Cookie', await buildAuthCookie(payload, fresh))
  return response
}
