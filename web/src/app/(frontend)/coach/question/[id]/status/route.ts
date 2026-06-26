import config from '@payload-config'
import { getPayload } from 'payload'
import { NextResponse } from 'next/server'

import { coachGroupIds, isAdmin, isCoach } from '@/access/roles'
import { relId } from '@/lib/relId'

// POST { status: 'read'|'answered' } → тренер двигает статус вопроса (M3-PR11).
// #015: тренер правит ТОЛЬКО вопросы своих групп (проверяем group ∈ coachGroupIds).
// Статус-машина односторонняя; обновление overrideAccess после проверки владения.
export const dynamic = 'force-dynamic'

export const POST = async (req: Request, ctx: { params: Promise<{ id: string }> }): Promise<Response> => {
  try {
    const payload = await getPayload({ config })
    const { user } = await payload.auth({ headers: req.headers })
    if (!user || !(isCoach(user) || isAdmin(user))) return NextResponse.json({ ok: false }, { status: 401 })

    const { id } = await ctx.params
    const questionId = Number(id)
    if (!Number.isInteger(questionId)) return NextResponse.json({ ok: false }, { status: 400 })

    let status: unknown
    try {
      const parsed = (await req.json()) as { status?: unknown }
      status = parsed?.status
    } catch {
      // ниже 400
    }
    if (status !== 'read' && status !== 'answered') return NextResponse.json({ ok: false }, { status: 400 })

    const question = await payload
      .findByID({ collection: 'questions', id: questionId, depth: 0, overrideAccess: true })
      .catch(() => null)
    if (!question) return NextResponse.json({ ok: false }, { status: 404 })

    // Владение: группа вопроса — среди групп тренера (admin — любой).
    if (!isAdmin(user)) {
      const groupIds = await coachGroupIds({ payload } as never, user.id)
      if (!groupIds.includes(relId(question.group) ?? -1)) return NextResponse.json({ ok: false }, { status: 403 })
    }

    const now = new Date().toISOString()
    await payload.update({
      collection: 'questions',
      id: questionId,
      data: {
        status,
        ...(status === 'read' ? { readAt: now } : {}),
        ...(status === 'answered' ? { answeredAt: now } : {}),
      },
      overrideAccess: true,
    })

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[coach/question/status]', err)
    return NextResponse.json({ ok: false }, { status: 500 })
  }
}
