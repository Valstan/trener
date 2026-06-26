import { describe, it, expect, vi } from 'vitest'
import type { PayloadRequest } from 'payload'

import { fanOutScheduleChange } from './fanOutScheduleChange'
import { SCHEDULE_WAVE_CONTEXT_KEY } from './trackSessionChange'

// fanOutScheduleChange — логика фан-аута (mock req.payload, без БД). Фиксируем:
//  • H4: одно уведомление на родителя, дети сгруппированы в players[];
//  • C2: superseded непринятых прошлых волн + снимок changedAt в новых;
//  • G90: find/update/create — overrideAccess;
//  • ребёнок без родителя пропущен; нет волны → хук бездействует.

type AnyArgs = Record<string, unknown>

const makeReq = (players: { id: number; parent: number | null }[], context: Record<string, unknown>) => {
  const find = vi.fn(async (_args: AnyArgs) => ({ docs: players }))
  const create = vi.fn(async (_args: AnyArgs) => ({ id: 999 }))
  const update = vi.fn(async (_args: AnyArgs) => ({ docs: [] }))
  const logger = { info: vi.fn(), error: vi.fn() }
  const req = { context, payload: { find, create, update, logger } } as unknown as PayloadRequest
  return { req, find, create, update }
}

const WAVE = { type: 'changed' as const, changedAt: '2026-07-01T12:00:00.000Z' }

describe('fanOutScheduleChange', () => {
  it('волна → по одному уведомлению на родителя, дети сгруппированы, старые superseded', async () => {
    const context = { [SCHEDULE_WAVE_CONTEXT_KEY]: WAVE }
    const { req, find, create, update } = makeReq(
      [
        { id: 1, parent: 10 },
        { id: 2, parent: 10 },
        { id: 3, parent: 20 },
        { id: 4, parent: null }, // не привязан к родителю → пропуск
      ],
      context,
    )

    await fanOutScheduleChange({ doc: { id: 500, group: 77 }, req } as never)

    // дети тянутся по группе сессии, overrideAccess (G90)
    expect(find).toHaveBeenCalledOnce()
    expect((find.mock.calls[0][0] as AnyArgs).where).toEqual({ group: { equals: 77 } })
    expect((find.mock.calls[0][0] as AnyArgs).overrideAccess).toBe(true)

    // supersede прошлых волн (C2): один bulk-update, overrideAccess
    expect(update).toHaveBeenCalledOnce()
    const upd = update.mock.calls[0][0] as AnyArgs
    expect((upd.data as AnyArgs).status).toBe('superseded')
    expect(upd.overrideAccess).toBe(true)

    // по одному create на родителя (10 и 20), а не на ребёнка
    expect(create).toHaveBeenCalledTimes(2)
    const byParent = Object.fromEntries(
      create.mock.calls.map((c) => {
        const d = (c[0] as AnyArgs).data as AnyArgs
        return [d.parent, d]
      }),
    )
    expect(byParent[10].players).toEqual([1, 2]) // семья с двумя детьми — одно уведомление
    expect(byParent[20].players).toEqual([3])
    expect(byParent[10].type).toBe('changed')
    expect(byParent[10].status).toBe('delivered')
    expect(byParent[10].changedAt).toBe(WAVE.changedAt) // снимок волны
    expect((create.mock.calls[0][0] as AnyArgs).overrideAccess).toBe(true)
  })

  it('нет волны в context → хук бездействует', async () => {
    const { req, find, create, update } = makeReq([{ id: 1, parent: 10 }], {})

    await fanOutScheduleChange({ doc: { id: 500, group: 77 }, req } as never)

    expect(find).not.toHaveBeenCalled()
    expect(create).not.toHaveBeenCalled()
    expect(update).not.toHaveBeenCalled()
  })

  it('группа без детей → supersede есть, create нет', async () => {
    const context = { [SCHEDULE_WAVE_CONTEXT_KEY]: WAVE }
    const { req, create, update } = makeReq([], context)

    await fanOutScheduleChange({ doc: { id: 500, group: 77 }, req } as never)

    expect(update).toHaveBeenCalledOnce()
    expect(create).not.toHaveBeenCalled()
  })
})
