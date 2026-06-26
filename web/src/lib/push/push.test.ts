import { describe, it, expect } from 'vitest'

import { buildAnnouncementMessage, buildPushMessage } from './message'
import { isDeadSubscription } from './send'

// R4: payload пуша не несёт ПДн ребёнка — только неидентифицирующий текст + /parent.
describe('buildPushMessage', () => {
  it('changed → заголовок об изменении, ссылка на нейтральный /parent', () => {
    const m = buildPushMessage('changed')
    expect(m.title).toBe('Изменение в расписании')
    expect(m.url).toBe('/parent')
  })
  it('cancelled → заголовок об отмене', () => {
    expect(buildPushMessage('cancelled').title).toBe('Тренировка отменена')
  })
  it('R4: ни в одном поле нет имени/группы/телефона (только generic-текст + /parent)', () => {
    for (const type of ['changed', 'cancelled'] as const) {
      const m = buildPushMessage(type)
      const blob = `${m.title} ${m.body} ${m.url}`
      // нет id-сессии в url, нет персональных плейсхолдеров
      expect(m.url).toBe('/parent')
      expect(blob).not.toMatch(/\d{2,}/) // никаких id/телефонов
    }
  })
})

// R4: объявление пушит только зов открыть приложение — текст объявления НЕ в payload
// (он проходит через Apple/Google); родитель читает его из РФ-БД в ленте.
describe('buildAnnouncementMessage', () => {
  it('ссылка на нейтральный /parent, без ПДн и без текста объявления', () => {
    const m = buildAnnouncementMessage()
    expect(m.url).toBe('/parent')
    const blob = `${m.title} ${m.body} ${m.url}`
    expect(blob).not.toMatch(/\d{2,}/) // никаких id/телефонов
  })
})

describe('isDeadSubscription', () => {
  it('404/410 → мёртвая (dead-letter)', () => {
    expect(isDeadSubscription(404)).toBe(true)
    expect(isDeadSubscription(410)).toBe(true)
  })
  it('прочие коды / undefined → жива (ретейн)', () => {
    expect(isDeadSubscription(500)).toBe(false)
    expect(isDeadSubscription(429)).toBe(false)
    expect(isDeadSubscription(undefined)).toBe(false)
  })
})
