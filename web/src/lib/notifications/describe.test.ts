import { describe, it, expect } from 'vitest'

import { describeChange, formatDateTime } from './describe'

// describeChange — готовый текст для inbox (152-ФЗ: служебные поля сессии родителю
// напрямую не отдаём). Точную локализованную дату не проверяем (зависит от ICU/версии
// Node) — проверяем структуру: заголовок, состав строк, наличие перехода «→».

describe('formatDateTime', () => {
  it('валидная ISO → непустая строка', () => {
    expect(formatDateTime('2026-07-01T12:00:00.000Z').length).toBeGreaterThan(0)
  })
  it('null/мусор → пустая строка', () => {
    expect(formatDateTime(null)).toBe('')
    expect(formatDateTime('не-дата')).toBe('')
  })
})

describe('describeChange', () => {
  it('отмена → заголовок «отменена», одна строка', () => {
    const d = describeChange({ type: 'cancelled', startDate: '2026-07-01T12:00:00.000Z' })
    expect(d.title).toBe('Тренировка отменена')
    expect(d.lines).toHaveLength(1)
    expect(d.lines[0]).toContain('Отменена тренировка')
  })

  it('перенос времени → строка «Время: … → …»', () => {
    const d = describeChange({
      type: 'changed',
      changedFields: ['startDate', 'status'],
      prevStartDate: '2026-07-01T10:00:00.000Z',
      startDate: '2026-07-01T12:00:00.000Z',
    })
    expect(d.title).toBe('Изменение в расписании')
    expect(d.lines.some((l) => l.startsWith('Время:') && l.includes('→'))).toBe(true)
  })

  it('смена места → строка «Место: prev → new»', () => {
    const d = describeChange({
      type: 'changed',
      changedFields: ['location'],
      prevLocation: 'Поле А',
      location: 'Поле Б',
    })
    expect(d.lines).toContain('Место: Поле А → Поле Б')
  })

  it('изменение без отслеживаемых полей → запасная строка', () => {
    const d = describeChange({ type: 'changed', changedFields: ['status'] })
    expect(d.lines).toEqual(['Расписание тренировки изменено.'])
  })
})
