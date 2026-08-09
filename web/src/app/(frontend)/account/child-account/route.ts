import config from '@payload-config'
import { headers as nextHeaders } from 'next/headers'
import { getPayload } from 'payload'
import { NextResponse } from 'next/server'

import { isParent } from '@/access/roles'
import { relId } from '@/lib/relId'

const LOGIN_RE = /^[a-z0-9._-]{3,32}$/

export const POST = async (req: Request): Promise<Response> => {
  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers: await nextHeaders() })
  if (!user || !isParent(user)) return NextResponse.json({ ok: false }, { status: 403 })

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null
  const playerId = Number(body?.playerId)
  const name = typeof body?.name === 'string' ? body.name.trim() : ''
  const login = typeof body?.login === 'string' ? body.login.trim().toLowerCase() : ''
  const password = typeof body?.password === 'string' ? body.password : ''
  const dateOfBirth = typeof body?.dateOfBirth === 'string' ? body.dateOfBirth : ''
  if (!Number.isInteger(playerId) || !name || !LOGIN_RE.test(login) || password.length < 8 || !/^\d{4}-\d{2}-\d{2}$/.test(dateOfBirth)) {
    return NextResponse.json({ ok: false }, { status: 400 })
  }

  const owned = await payload.find({
    collection: 'players',
    where: { and: [{ id: { equals: playerId } }, { parent: { equals: user.id } }] },
    depth: 0,
    limit: 1,
    overrideAccess: true,
  })
  const player = owned.docs[0]
  if (!player) return NextResponse.json({ ok: false }, { status: 404 })

  try {
    const accountId = relId(player.account)
    // branch аккаунта НЕ трогаем: update с branch:null затирал филиал ребёнку,
    // пришедшему саморегистрацией (его выставил respond-маршрут подтверждения).
    const account = accountId
      ? await payload.update({ collection: 'users', id: accountId, data: { name, login, password, roles: ['child'], status: 'approved' }, overrideAccess: true })
      : await payload.create({ collection: 'users', data: { name, login, password, email: `${login}@children.trener.invalid`, roles: ['child'], status: 'approved' }, overrideAccess: true })

    await payload.update({ collection: 'players', id: player.id, data: { name, dateOfBirth, account: account.id }, overrideAccess: true })
    return NextResponse.json({ ok: true })
  } catch (err) {
    payload.logger.warn({ err, parentId: user.id, playerId }, '[child-account] create/update failed')
    return NextResponse.json({ ok: false }, { status: 409 })
  }
}
