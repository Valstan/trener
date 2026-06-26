import config from '@payload-config'
import { getPayload } from 'payload'
import { NextResponse } from 'next/server'

// POST { endpoint } → удалить web-push подписку текущего пользователя по endpoint.
// Только свою (where user==сессия AND endpoint). server-mediated (#015).
export const dynamic = 'force-dynamic'

export const POST = async (req: Request): Promise<Response> => {
  try {
    const payload = await getPayload({ config })
    const { user } = await payload.auth({ headers: req.headers })
    if (!user) return NextResponse.json({ ok: false }, { status: 401 })

    let endpoint = ''
    try {
      const body = (await req.json()) as { endpoint?: unknown }
      if (typeof body?.endpoint === 'string') endpoint = body.endpoint
    } catch {
      // ниже 400
    }
    if (!endpoint) return NextResponse.json({ ok: false }, { status: 400 })

    await payload.delete({
      collection: 'devices',
      where: { and: [{ user: { equals: user.id } }, { endpoint: { equals: endpoint } }] },
      overrideAccess: true,
    })
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[push/unsubscribe]', err)
    return NextResponse.json({ ok: false }, { status: 500 })
  }
}
