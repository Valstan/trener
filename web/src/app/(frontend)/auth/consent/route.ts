import config from '@payload-config'
import { getPayload } from 'payload'
import { NextResponse } from 'next/server'

import { isParent } from '@/access/roles'
import { CONSENT_POLICY_VERSION } from '@/lib/consent'

// POST → родитель даёт согласие 152-ФЗ на обработку ПДн своих детей. Сервер берёт
// parent из сессии (не из клиента) и список детей — из привязки (readPlayers), чтобы
// нельзя было подписать согласие за чужого. Идемпотентно: повторная отправка не плодит
// записи. Полный UX «отдельной бумагой» + текст политики — PR3 (Consents.ts).
export const dynamic = 'force-dynamic'

export const POST = async (req: Request): Promise<Response> => {
  try {
    const payload = await getPayload({ config })
    const { user } = await payload.auth({ headers: req.headers })
    if (!user || !isParent(user)) {
      return NextResponse.json({ ok: false }, { status: 401 })
    }

    const existing = await payload.find({
      collection: 'consents',
      where: { parent: { equals: user.id } },
      limit: 1,
      depth: 0,
      pagination: false,
      overrideAccess: true,
    })
    if (existing.docs.length > 0) {
      return NextResponse.json({ ok: true, redirect: '/' })
    }

    const players = await payload.find({
      collection: 'players',
      where: { parent: { equals: user.id } },
      limit: 100,
      depth: 0,
      pagination: false,
      user,
      overrideAccess: false,
    })
    const playerIds = players.docs.map((p) => p.id)

    await payload.create({
      collection: 'consents',
      data: {
        parent: user.id,
        players: playerIds,
        consentGiven: true,
        policyVersion: CONSENT_POLICY_VERSION,
      },
      user,
      overrideAccess: false,
    })

    return NextResponse.json({ ok: true, redirect: '/' })
  } catch (err) {
    console.error('[auth/consent]', err)
    return NextResponse.json({ ok: false }, { status: 500 })
  }
}
