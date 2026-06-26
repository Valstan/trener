import config from '@payload-config'
import { getPayload } from 'payload'
import { NextResponse } from 'next/server'

import { isParent } from '@/access/roles'
import { decideAck } from '@/lib/notifications/ack'
import { relId } from '@/lib/relId'

// POST { notificationId } → родитель подтверждает («вижу») уведомление об изменении.
// M8: статус двигается только вперёд и только владельцем. Сервер берёт parent из
// сессии, грузит уведомление overrideAccess, сверяет владение+статус (decideAck),
// затем overrideAccess-update. Это закрывает прямой client-PATCH (update=adminOnly).
export const dynamic = 'force-dynamic'

export const POST = async (req: Request): Promise<Response> => {
  try {
    const payload = await getPayload({ config })
    const { user } = await payload.auth({ headers: req.headers })
    if (!user || !isParent(user)) return NextResponse.json({ ok: false }, { status: 401 })

    let notificationId: unknown
    try {
      const body = (await req.json()) as { notificationId?: unknown }
      notificationId = body?.notificationId
    } catch {
      // некорректное тело — ниже отдадим 400
    }
    if (typeof notificationId !== 'number' && typeof notificationId !== 'string') {
      return NextResponse.json({ ok: false }, { status: 400 })
    }

    const notif = await payload
      .findByID({ collection: 'notifications', id: notificationId, depth: 0, overrideAccess: true })
      .catch(() => null)

    const decision = decideAck(notif ? { parent: relId(notif.parent), status: notif.status } : null, user.id)
    if (decision.action === 'reject') {
      return NextResponse.json({ ok: false, reason: decision.reason }, { status: decision.status })
    }
    if (decision.action === 'ack') {
      await payload.update({
        collection: 'notifications',
        id: notificationId,
        data: { status: 'acked', ackedAt: new Date().toISOString() },
        overrideAccess: true,
      })
    }
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[parent/ack]', err)
    return NextResponse.json({ ok: false }, { status: 500 })
  }
}
