import config from '@payload-config'
import { getPayload } from 'payload'
import { NextResponse } from 'next/server'

import { isParent } from '@/access/roles'
import { relId } from '@/lib/relId'

// POST { body } → реплика родителя в СВОЕЙ нитке чата M4. #015: владение —
// question.parent === user (404 без различения not-found/чужая, анти-enumeration).
// Статус головы → new (тренеру нужно снова взглянуть); afterChange-хук
// (fanOutQuestionReply) пушит тренерам группы.
export const dynamic = 'force-dynamic'

export const POST = async (req: Request, ctx: { params: Promise<{ id: string }> }): Promise<Response> => {
  try {
    const payload = await getPayload({ config })
    const { user } = await payload.auth({ headers: req.headers })
    if (!user || !isParent(user)) return NextResponse.json({ ok: false }, { status: 401 })

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
    if (!question || relId(question.parent) !== user.id) {
      return NextResponse.json({ ok: false }, { status: 404 })
    }

    const groupId = relId(question.group)
    if (groupId == null) return NextResponse.json({ ok: false }, { status: 404 })

    await payload.create({
      collection: 'question-messages',
      data: {
        question: questionId,
        group: groupId,
        parent: user.id,
        author: user.id,
        authorRole: 'parent',
        body,
      },
      overrideAccess: true,
    })

    await payload.update({
      collection: 'questions',
      id: questionId,
      data: { status: 'new' },
      overrideAccess: true,
    })

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[parent/question/reply]', err)
    return NextResponse.json({ ok: false }, { status: 500 })
  }
}
