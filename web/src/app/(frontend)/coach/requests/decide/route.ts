import config from '@payload-config'
import { getPayload } from 'payload'
import { NextResponse } from 'next/server'

import { isFullOwner } from '@/access/roles'
import { adultApproveData, childTransition, type ChildRegStatus } from '@/lib/registrationFlow'

// POST — решения владельца по заявкам (инбокс /coach/requests):
//   { kind: 'adult', id, action: 'approve', branchId }  → роль из requestedRole + филиал
//   { kind: 'adult', id, action: 'reject' }             → удаление applicant-аккаунта
//   { kind: 'child', id, action: 'reject' | 'reopen' }  → переход статуса заявки
// Назначение родителя детской заявке — прежний /coach/child-requests/assign.
//
// Отклонение взрослого = удаление аккаунта: в enum users.status нет 'rejected', а
// пустой applicant без содержательной роли ничем не владеет (cleanupUserRelations
// подчистит хвосты). Человек может зарегистрироваться заново с тем же email.
export const dynamic = 'force-dynamic'

export const POST = async (req: Request): Promise<Response> => {
  try {
    const payload = await getPayload({ config })
    const { user } = await payload.auth({ headers: req.headers })
    // Только ЖИВОЙ владелец: одобрение/удаление живых заявок — не демо-операция (D-029/#166).
    if (!user || !isFullOwner(user)) return NextResponse.json({ ok: false }, { status: 403 })

    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null
    const id = Number(body?.id)
    const kind = body?.kind
    const action = body?.action
    if (!Number.isInteger(id) || id <= 0) return NextResponse.json({ ok: false }, { status: 400 })

    if (kind === 'adult') {
      const target = await payload
        .findByID({ collection: 'users', id, depth: 0, overrideAccess: true })
        .catch(() => null)
      const roles = Array.isArray(target?.roles) ? target!.roles : []
      const isApplicant = roles.includes('applicant') && !roles.some((r) => r !== 'applicant')
      if (!target || !isApplicant) return NextResponse.json({ ok: false }, { status: 404 })

      if (action === 'approve') {
        const branchId = Number(body?.branchId)
        const data = adultApproveData(target.requestedRole, Number.isInteger(branchId) && branchId > 0 ? branchId : null)
        if (!data) return NextResponse.json({ error: 'Выберите филиал' }, { status: 400 })
        await payload.update({ collection: 'users', id, data, overrideAccess: true })
        return NextResponse.json({ ok: true })
      }
      if (action === 'reject') {
        await payload.delete({ collection: 'users', id, overrideAccess: true })
        return NextResponse.json({ ok: true })
      }
      return NextResponse.json({ ok: false }, { status: 400 })
    }

    if (kind === 'child') {
      if (action !== 'reject' && action !== 'reopen') return NextResponse.json({ ok: false }, { status: 400 })
      const registration = await payload
        .findByID({ collection: 'child-registrations', id, depth: 0, overrideAccess: true })
        .catch(() => null)
      if (!registration) return NextResponse.json({ ok: false }, { status: 404 })
      const next = childTransition(registration.status as ChildRegStatus, action)
      if (!next) return NextResponse.json({ ok: false }, { status: 409 })
      await payload.update({
        collection: 'child-registrations',
        id,
        // reopen снимает назначенного родителя — владелец назначит заново.
        data: { status: next, ...(action === 'reopen' ? { proposedParent: null, branch: null } : {}) },
        overrideAccess: true,
      })
      return NextResponse.json({ ok: true })
    }

    return NextResponse.json({ ok: false }, { status: 400 })
  } catch (err) {
    console.error('[coach/requests/decide]', err)
    return NextResponse.json({ ok: false }, { status: 500 })
  }
}
