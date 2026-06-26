import { describe, it, expect } from 'vitest'
import type { PayloadRequest } from 'payload'

import { trackSessionChange, SCHEDULE_WAVE_CONTEXT_KEY, type ScheduleChangeWave } from './trackSessionChange'

// trackSessionChange — чистая логика diff'а (без БД). Фиксируем:
//  • C1: устойчивость к частичному патчу (только пришедшие + реально изменившиеся поля);
//  • даты сравниваются по мгновению (иной формат той же даты ≠ правка);
//  • тип волны changed vs cancelled; авто-бамп planned→changed при переносе;
//  • незначимая правка / create — волну не поднимают.

type RunArgs = {
  data: Record<string, unknown>
  originalDoc?: Record<string, unknown> | null
  operation: 'create' | 'update'
}

const run = ({ data, originalDoc, operation }: RunArgs) => {
  const context: Record<string, unknown> = {}
  const req = { context } as unknown as PayloadRequest
  const out = trackSessionChange({ data, originalDoc, operation, req } as never) as Record<string, unknown>
  return { data: out, wave: context[SCHEDULE_WAVE_CONTEXT_KEY] as ScheduleChangeWave | undefined }
}

const PLANNED = { startDate: '2026-07-01T10:00:00.000Z', endDate: null, location: 'Поле А', status: 'planned' }

describe('trackSessionChange', () => {
  it('перенос времени на planned: волна changed + авто-бамп статуса + снимок prev*', () => {
    const { data, wave } = run({
      operation: 'update',
      originalDoc: PLANNED,
      data: { startDate: '2026-07-01T12:00:00.000Z' },
    })
    expect(wave?.type).toBe('changed')
    expect(data.changedFields).toContain('startDate')
    expect(data.changedFields).toContain('status') // авто-бамп planned→changed
    expect(data.status).toBe('changed')
    expect(data.prevStartDate).toBe('2026-07-01T10:00:00.000Z')
    expect(data.prevLocation).toBe('Поле А')
    expect(typeof data.changedAt).toBe('string')
    expect(wave?.changedAt).toBe(data.changedAt) // снимок волны == метка на сессии
  })

  it('отмена: волна cancelled, статус не бампится', () => {
    const { data, wave } = run({
      operation: 'update',
      originalDoc: PLANNED,
      data: { status: 'cancelled' },
    })
    expect(wave?.type).toBe('cancelled')
    expect(data.changedFields).toEqual(['status'])
    expect(data.status).toBe('cancelled')
  })

  it('смена места на уже changed: только location, статус не дублируется', () => {
    const { data, wave } = run({
      operation: 'update',
      originalDoc: { ...PLANNED, status: 'changed' },
      data: { location: 'Поле Б' },
    })
    expect(wave?.type).toBe('changed')
    expect(data.changedFields).toEqual(['location']) // status уже changed → не бампим
  })

  it('та же дата в ином формате (без мс/без Z) — не правка', () => {
    const { data, wave } = run({
      operation: 'update',
      originalDoc: PLANNED,
      data: { startDate: '2026-07-01T10:00:00Z' },
    })
    expect(wave).toBeUndefined()
    expect(data.changedAt).toBeUndefined()
  })

  it('правка только заметки — не волна', () => {
    const { data, wave } = run({
      operation: 'update',
      originalDoc: PLANNED,
      data: { note: 'размялись' },
    })
    expect(wave).toBeUndefined()
    expect(data.changedAt).toBeUndefined()
  })

  it('создание сессии — не волна', () => {
    const { data, wave } = run({
      operation: 'create',
      originalDoc: null,
      data: { startDate: '2026-07-01T10:00:00.000Z', status: 'planned' },
    })
    expect(wave).toBeUndefined()
    expect(data.changedAt).toBeUndefined()
  })
})
