import config from '@payload-config'
import { headers as nextHeaders } from 'next/headers'
import { notFound, redirect } from 'next/navigation'
import { getPayload } from 'payload'
import React from 'react'

import { isChild, isCoach, isOwner, isParent, isPending } from '@/access/roles'
import { resolveMatchViews } from '@/lib/matches'

import { AppShell, CHILD_TABS, COACH_TABS, PARENT_TABS } from '../../components/AppShell'
import { MatchCard } from '../../components/MatchCard'
import { MatchCommentForm } from '../../components/MatchCommentForm'

export const dynamic = 'force-dynamic'

const MatchPage = async ({ params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params
  const matchId = Number(id)
  if (!Number.isInteger(matchId) || matchId < 1) notFound()
  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers: await nextHeaders() })
  if (!user) redirect('/login')
  if (isPending(user)) redirect('/pending')

  let match
  try {
    match = await payload.findByID({ collection: 'matches', id: matchId, depth: 0, user, overrideAccess: false })
  } catch { notFound() }
  const view = (await resolveMatchViews(payload, [match]))[0]
  if (!view) notFound()
  const comments = await payload.find({ collection: 'match-comments', where: { match: { equals: matchId } }, sort: 'createdAt', limit: 500, pagination: false, depth: 0, user, overrideAccess: false })
  const parentOnly = isParent(user) && !isCoach(user) && !isOwner(user)
  const tabs = isChild(user) ? CHILD_TABS : parentOnly ? PARENT_TABS : COACH_TABS
  const back = isChild(user) ? '/child' : parentOnly ? '/parent/matches' : '/coach/matches'

  return <AppShell title="Матч" tabs={tabs} active="matches" back={{ href: back }}>
    <MatchCard match={view} showCommentsLink={false} />
    <h2 className="section-title">Комментарии</h2>
    <div className="stack-sm">
      {comments.docs.length === 0 && <p className="muted">Комментариев пока нет.</p>}
      {comments.docs.map((comment) => <div className="card" key={comment.id}>
        <div className="row-between"><strong>{comment.authorName}</strong><span className="muted small">{new Date(comment.createdAt).toLocaleString('ru-RU')}</span></div>
        <p className="pre">{comment.body}</p>
      </div>)}
      <MatchCommentForm matchId={matchId} />
    </div>
  </AppShell>
}

export default MatchPage
