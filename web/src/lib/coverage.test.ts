import { describe, it, expect } from 'vitest'

import { buildCoverage, type CoverageEntry } from './coverage'

const entry = (parentId: number, status: CoverageEntry['status']): CoverageEntry => ({
  parentId,
  parentName: `Родитель ${parentId}`,
  childNames: [`Ребёнок ${parentId}`],
  status,
})

describe('buildCoverage', () => {
  it('считает N из M и раскладывает по статусам', () => {
    const s = buildCoverage([entry(1, 'acked'), entry(2, 'acked'), entry(3, 'seen'), entry(4, 'delivered')])
    expect(s.total).toBe(4) // M
    expect(s.acked).toBe(2) // N
    expect(s.seen).toBe(1)
    expect(s.delivered).toBe(1)
    expect(s.done).toHaveLength(2)
    expect(s.pending).toHaveLength(2) // delivered + seen
    expect(s.pending[0].status).toBe('delivered') // не открыл — выше в списке на обзвон
  })

  it('пустая волна → все нули', () => {
    const s = buildCoverage([])
    expect(s).toMatchObject({ total: 0, acked: 0, seen: 0, delivered: 0 })
    expect(s.pending).toHaveLength(0)
    expect(s.done).toHaveLength(0)
  })

  it('все подтвердили → pending пуст', () => {
    const s = buildCoverage([entry(1, 'acked'), entry(2, 'acked')])
    expect(s.acked).toBe(2)
    expect(s.total).toBe(2)
    expect(s.pending).toHaveLength(0)
  })
})
