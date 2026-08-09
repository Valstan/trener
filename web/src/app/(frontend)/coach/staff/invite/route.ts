import config from '@payload-config'
import { randomUUID } from 'crypto'
import { getPayload } from 'payload'
import { NextResponse } from 'next/server'

import { adminBranchId, isOwner } from '@/access/roles'
import { applicantUpgrade } from '@/lib/auth/applicantUpgrade'
import { createLoginToken } from '@/lib/auth/magicLink'
import { sendStaffInviteEmail } from '@/lib/email/magicLinkEmail'
import { relId } from '@/lib/relId'
import { parseStaffInvite } from '@/lib/staffInvite'

// POST { email, name, role, branchId?, groupIds? } → заводит сотрудника и шлёт ему
// ссылку входа на email (п.5 аудита 30.07).
//
// До этого тренера заводили только через админку Payload, а её форма создания
// пользователя ТРЕБУЕТ пароль — владелец придумывал его и передавал руками. Здесь
// пароль случайный, наружу не показывается и никому не нужен: вход по ссылке,
// постоянный пароль сотрудник задаст сам в «Аккаунте».
//
// Права: владелец приглашает кого угодно в любой филиал; админ филиала — только
// тренера и только в СВОЙ филиал (роль owner/admin он раздавать не может — это
// повышение привилегий). Группы назначаем только те, что доступны приглашающему.
export const dynamic = 'force-dynamic'

const ROLE_LABEL: Record<string, string> = { coach: 'тренер', admin: 'администратор филиала' }

export const POST = async (req: Request): Promise<Response> => {
  try {
    const payload = await getPayload({ config })
    const { user } = await payload.auth({ headers: req.headers })
    if (!user) return NextResponse.json({ ok: false }, { status: 401 })

    const owner = isOwner(user)
    const myBranch = adminBranchId(user)
    if (!owner && myBranch == null) return NextResponse.json({ ok: false }, { status: 403 })

    let raw: unknown = null
    try {
      raw = await req.json()
    } catch {
      // ниже 400
    }
    const input = parseStaffInvite(raw)
    if (!input) return NextResponse.json({ ok: false, reason: 'input' }, { status: 400 })

    // Админ филиала не раздаёт роль администратора и не приглашает в чужой филиал.
    if (!owner) {
      if (input.role !== 'coach') return NextResponse.json({ ok: false, reason: 'role' }, { status: 403 })
      if (input.branchId != null && input.branchId !== myBranch) {
        return NextResponse.json({ ok: false, reason: 'branch' }, { status: 403 })
      }
    }
    const branchId = owner ? input.branchId : Number(myBranch)
    if (branchId == null) return NextResponse.json({ ok: false, reason: 'branch' }, { status: 400 })

    // Уже заведён? Повторное приглашение — это «перевыпустить ссылку», а не
    // перезапись чужого аккаунта: роли и филиал живого аккаунта не трогаем.
    // ИСКЛЮЧЕНИЕ — застрявший applicant (саморег без содержательной роли): его
    // приглашение и есть подтверждение, иначе он навсегда залипает на /pending
    // (applicantUpgrade возвращает null для всех «живых» ролей).
    const existing = await payload.find({
      collection: 'users',
      where: { email: { equals: input.email } },
      limit: 1,
      depth: 0,
      pagination: false,
      overrideAccess: true,
    })

    let userId: number
    let created = false
    if (existing.docs[0]) {
      userId = existing.docs[0].id
      const upgraded = applicantUpgrade(existing.docs[0].roles, input.role)
      if (upgraded) {
        await payload.update({
          collection: 'users',
          id: userId,
          data: {
            roles: upgraded,
            status: 'approved',
            branch: branchId,
            ...(existing.docs[0].name ? {} : { name: input.name }),
          },
          overrideAccess: true,
        })
      }
    } else {
      const account = await payload.create({
        collection: 'users',
        data: {
          email: input.email,
          name: input.name,
          roles: [input.role],
          branch: branchId,
          status: 'approved',
          // Случайный пароль: он никому не известен и не нужен. Локальную стратегию
          // не отключаем (она нужна админке), но вход у сотрудника — по ссылке.
          password: `${randomUUID()}${randomUUID()}`,
        },
        overrideAccess: true,
      })
      userId = account.id
      created = true
    }

    // Назначение в группы: только те, что приглашающий видит под своей ролью.
    let assigned = 0
    if (input.groupIds.length) {
      const allowed = await payload.find({
        collection: 'groups',
        where: { id: { in: input.groupIds } },
        depth: 0,
        limit: 200,
        pagination: false,
        user,
        overrideAccess: false,
      })
      for (const group of allowed.docs) {
        const coaches = (Array.isArray(group.coaches) ? group.coaches : [])
          .map((c) => relId(c))
          .filter((v): v is number => v != null)
        if (coaches.includes(userId)) continue
        await payload.update({
          collection: 'groups',
          id: group.id,
          data: { coaches: [...coaches, userId] },
          overrideAccess: true,
        })
        assigned++
      }
    }

    const token = await createLoginToken(payload, input.email)
    if (token) await sendStaffInviteEmail(payload, input.email, token, ROLE_LABEL[input.role] ?? 'сотрудник')

    return NextResponse.json({ ok: true, created, assigned })
  } catch (err) {
    console.error('[coach/staff/invite POST]', err)
    return NextResponse.json({ ok: false }, { status: 500 })
  }
}
