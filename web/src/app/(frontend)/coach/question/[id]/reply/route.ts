import config from '@payload-config'
import { getPayload } from 'payload'
import { NextResponse } from 'next/server'

import { coachGroupIds, isAdmin, isCoach } from '@/access/roles'
import { relId } from '@/lib/relId'

// POST { body } → ответ тренера в нитке чата M4. #015: тренер отвечает ТОЛЬКО на
// вопросы своих групп (как /coach/question/[id]/status). Создание сообщения +
// статус головы → answered; afterChange-хук (fanOutQuestionReply) пушит родителю.
export const dynamic = 'force-dynamic'

export const POST = async (req: Request, ctx: { params: Promise<{ id: string }> }): Promise<Response> => {
  try {
    const payload = await getPayload({ config })
    const { user } = await payload.auth({ headers: req.headers })
    if (!user || !(isCoach(user) || isAdmin(user))) return NextResponse.json({ ok: false }, { status: 401 })

    const { id } = await ctx.params
    const questionId = Number(id)
    if (!Number.isInteger(questionId)) return NextResponse.json({ ok: false }, { status: 400 })

    let body = ''
    try {
      const parsed = (await req.json()) as { body?: unknown }
      if (typeof parsed?.body === 'string') body = parsed.body.trim().slice(0, 1000)
    } catch {
      // ниже 400
    }
    if (!body) return NextResponse.json({ ok: false }, { status: 400 })

    const question = await payload
      .findByID({ collection: 'questions', id: questionId, depth: 0, overrideAccess: true })
      .catch(() => null)
    if (!question) return NextResponse.json({ ok: false }, { status: 404 })

    const groupId = relId(question.group)
    const parentId = relId(question.parent)
    if (groupId == null || parentId == null) return NextResponse.json({ ok: false }, { status: 404 })

    // Владение: группа вопроса — среди групп тренера (admin — любой).
    if (!isAdmin(user)) {
      const groupIds = await coachGroupIds({ payload } as never, user.id)
      if (!groupIds.includes(groupId)) return NextResponse.json({ ok: false }, { status: 403 })
    }

    await payload.create({
      collection: 'question-messages',
      data: {
        question: questionId,
        group: groupId,
        parent: parentId,
        author: user.id,
        authorRole: 'coach',
        body,
      },
      overrideAccess: true,
    })

    await payload.update({
      collection: 'questions',
      id: questionId,
      data: { status: 'answered', answeredAt: new Date().toISOString() },
      overrideAccess: true,
    })

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[coach/question/reply]', err)
    return NextResponse.json({ ok: false }, { status: 500 })
  }
}
