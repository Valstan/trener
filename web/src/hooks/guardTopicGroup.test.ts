import { describe, expect, it, vi } from 'vitest'
import type { PayloadRequest } from 'payload'

import { guardTopicGroup } from './guardTopicGroup'

// Регрессия на реальную дыру, найденную на стенде 30.07: тренер филиала «Вятские
// Поляны» завёл тему в группе «Малмыжа» и получил 200. Причина — access-функция,
// вернувшая Where, на СОЗДАНИИ ничего не ограничивает, Payload читает её как «можно».
// Здесь гейт проверяется напрямую, чтобы дыра не открылась заново.

const reqFor = (user: unknown, groupsOfCoach: number[], groupsOfBranch: number[] = []): PayloadRequest =>
  ({
    user,
    payload: {
      find: vi.fn(async ({ collection, where }: { collection: string; where?: Record<string, unknown> }) => {
        if (collection !== 'groups') return { docs: [] }
        // branchGroupIds фильтрует по branch, coachGroupIds — по coaches.
        const byBranch = where && 'branch' in where
        const ids = byBranch ? groupsOfBranch : groupsOfCoach
        return { docs: ids.map((id) => ({ id })) }
      }),
    },
  }) as unknown as PayloadRequest

const call = (req: PayloadRequest, group: number) =>
  guardTopicGroup({ data: { title: 'т', group }, req, operation: 'create' } as never)

describe('guardTopicGroup', () => {
  it('тренер заводит тему в своей группе — пропускает', async () => {
    const req = reqFor({ id: 5, roles: ['coach'] }, [1, 2])
    await expect(call(req, 1)).resolves.toBeTruthy()
  })

  it('тренер в ЧУЖОЙ группе — отказ', async () => {
    const req = reqFor({ id: 5, roles: ['coach'] }, [1, 2])
    await expect(call(req, 3)).rejects.toThrow(/своей группе/)
  })

  it('админ филиала ограничен группами своего филиала', async () => {
    const admin = { id: 7, roles: ['admin'], branch: 2 }
    await expect(call(reqFor(admin, [], [10, 11]), 10)).resolves.toBeTruthy()
    await expect(call(reqFor(admin, [], [10, 11]), 12)).rejects.toThrow(/своей группе/)
  })

  it('владелец сети — без ограничений', async () => {
    const req = reqFor({ id: 1, roles: ['owner'] }, [])
    await expect(call(req, 999)).resolves.toBeTruthy()
  })

  it('служебный путь без пользователя (сид, overrideAccess) не блокируется', async () => {
    const req = reqFor(null, [])
    await expect(call(req, 42)).resolves.toBeTruthy()
  })

  it('тема без группы — отказ', async () => {
    const req = reqFor({ id: 5, roles: ['coach'] }, [1])
    await expect(
      guardTopicGroup({ data: { title: 'т' }, req, operation: 'create' } as never),
    ).rejects.toThrow(/группа/)
  })
})
