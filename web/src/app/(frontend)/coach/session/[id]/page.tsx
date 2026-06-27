import config from '@payload-config'
import { headers as nextHeaders } from 'next/headers'
import { notFound, redirect } from 'next/navigation'
import { getPayload } from 'payload'
import React from 'react'

import { isAdmin, isCoach } from '@/access/roles'
import { coachCanSeeSession, loadCoverage } from '@/lib/coverage'
import { describeChange } from '@/lib/notifications/describe'

import { AppShell } from '../../../components/AppShell'
import { CoverageView } from './CoverageView'

// Coverage-экран тренера по одной сессии: «приняли N из M» + список непринявших
// (кому напомнить — H3: эскалация = тренер сам) + недостижимые (дети без родителя,
// #059). Доступ: персонал, и только свои сессии (#015).
export const dynamic = 'force-dynamic'

const CoachSessionPage = async ({ params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params
  const sessionId = Number(id)
  if (!Number.isFinite(sessionId)) notFound()

  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers: await nextHeaders() })
  if (!user) redirect('/login')
  if (!(isCoach(user) || isAdmin(user))) redirect('/')

  const session = await payload
    .findByID({ collection: 'training-sessions', id: sessionId, depth: 0, overrideAccess: true })
    .catch(() => null)
  if (!session) notFound()
  if (!(await coachCanSeeSession(payload, user, session))) redirect('/coach/schedule')

  const coverage = await loadCoverage(payload, session)
  const change = coverage.wave
    ? describeChange({
        type: session.status === 'cancelled' ? 'cancelled' : 'changed',
        startDate: session.startDate,
        location: session.location,
        prevStartDate: session.prevStartDate,
        prevLocation: session.prevLocation,
        changedFields: Array.isArray(session.changedFields) ? (session.changedFields as string[]) : [],
      })
    : null

  return (
    <AppShell title="Тренировка" back={{ href: '/coach/schedule', label: 'Расписание' }}>
      <CoverageView sessionId={session.id} status={session.status} change={change} initial={coverage} />
    </AppShell>
  )
}

export default CoachSessionPage
