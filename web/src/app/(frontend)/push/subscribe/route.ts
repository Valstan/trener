import config from '@payload-config'
import { getPayload } from 'payload'
import { NextResponse } from 'next/server'

// POST { subscription: PushSubscriptionJSON, platform? } → сохранить web-push подписку
// текущего пользователя (Devices). user берётся из сессии (не из клиента) — нельзя
// подписать чужой аккаунт. Дедуп по endpoint (unique): повторная подписка того же
// браузера обновляет запись, а не плодит. server-mediated (#015): прямой create закрыт.
export const dynamic = 'force-dynamic'

type SubJSON = { endpoint?: unknown; keys?: { p256dh?: unknown; auth?: unknown } }

export const POST = async (req: Request): Promise<Response> => {
  try {
    const payload = await getPayload({ config })
    const { user } = await payload.auth({ headers: req.headers })
    if (!user) return NextResponse.json({ ok: false }, { status: 401 })

    let sub: SubJSON | undefined
    let platform: string | undefined
    try {
      const body = (await req.json()) as { subscription?: SubJSON; platform?: string }
      sub = body?.subscription
      platform = typeof body?.platform === 'string' ? body.platform : undefined
    } catch {
      // ниже отдадим 400
    }

    const endpoint = typeof sub?.endpoint === 'string' ? sub.endpoint : ''
    const p256dh = typeof sub?.keys?.p256dh === 'string' ? sub.keys.p256dh : ''
    const auth = typeof sub?.keys?.auth === 'string' ? sub.keys.auth : ''
    if (!endpoint || !p256dh || !auth) return NextResponse.json({ ok: false }, { status: 400 })

    const userAgent = req.headers.get('user-agent') ?? undefined
    const data = { user: user.id, endpoint, p256dh, auth, platform, userAgent, failureCount: 0 }

    // upsert по endpoint (unique): тот же браузер мог быть привязан к другому юзеру.
    const existing = await payload.find({
      collection: 'devices',
      where: { endpoint: { equals: endpoint } },
      limit: 1,
      depth: 0,
      pagination: false,
      overrideAccess: true,
    })
    if (existing.docs[0]) {
      await payload.update({ collection: 'devices', id: existing.docs[0].id, data, overrideAccess: true })
    } else {
      await payload.create({ collection: 'devices', data, overrideAccess: true })
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[push/subscribe]', err)
    return NextResponse.json({ ok: false }, { status: 500 })
  }
}
