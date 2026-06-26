import config from '@payload-config'
import { getPayload } from 'payload'
import { NextResponse } from 'next/server'

import { isParent } from '@/access/roles'

// POST → пометить непросмотренные уведомления родителя как «просмотрено»
// (delivered → seen). Зовётся клиентом при открытии inbox (на маунте, не на
// prefetch — иначе seen ставился бы раньше реального открытия). Идемпотентно:
// повторный вызов не находит delivered и ничего не делает. seen — мягкий сигнал
// для coverage («открыл, но не подтвердил»); корректность держит acked.
export const dynamic = 'force-dynamic'

export const POST = async (req: Request): Promise<Response> => {
  try {
    const payload = await getPayload({ config })
    const { user } = await payload.auth({ headers: req.headers })
    if (!user || !isParent(user)) return NextResponse.json({ ok: false }, { status: 401 })

    await payload.update({
      collection: 'notifications',
      where: { and: [{ parent: { equals: user.id } }, { status: { equals: 'delivered' } }] },
      data: { status: 'seen', seenAt: new Date().toISOString() },
      overrideAccess: true,
    })
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[parent/seen]', err)
    return NextResponse.json({ ok: false }, { status: 500 })
  }
}
