import { describe, it, expect } from 'vitest'

import {
  buildAnnouncementMessage,
  buildChatMessage,
  buildPushMessage,
  buildQuestionMessage,
  buildQuestionReplyMessage,
} from './message'
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

// R4: вопрос пушит тренеру только зов открыть инбокс — текст вопроса и имя родителя
// НЕ в payload; тренер читает из РФ-БД.
describe('buildQuestionMessage', () => {
  it('ссылка на инбокс тренера /coach/questions, без ПДн', () => {
    const m = buildQuestionMessage()
    expect(m.url).toBe('/coach/questions')
    const blob = `${m.title} ${m.body} ${m.url}`
    expect(blob).not.toMatch(/\d{2,}/)
  })
})

// R4 (M4): ответ тренера пушит родителю только зов открыть переписку — текст ответа
// и имена НЕ в payload; ссылка на нейтральный /parent/ask (не на нитку по id).
describe('buildQuestionReplyMessage', () => {
  it('ссылка на /parent/ask, без ПДн и без id нитки', () => {
    const m = buildQuestionReplyMessage()
    expect(m.url).toBe('/parent/ask')
    const blob = `${m.title} ${m.body} ${m.url}`
    expect(blob).not.toMatch(/\d{2,}/)
  })
})

// tag по типу события + urgency: изменения расписания — high (kickoff §2), остальное —
// normal; у каждого builder'а свой tag, чтобы чат не вытеснял с экрана отмену тренировки.
describe('tag и urgency', () => {
  it('изменение расписания — high, свой tag', () => {
    const m = buildPushMessage('cancelled')
    expect(m.urgency).toBe('high')
    expect(m.tag).toBe('trener-schedule')
  })
  it('остальные типы — normal и различающиеся tag (кроме пары вопрос/ответ)', () => {
    const rest = [buildAnnouncementMessage(), buildQuestionMessage(), buildChatMessage()]
    for (const m of rest) expect(m.urgency).toBe('normal')
    const tags = [...rest, buildPushMessage('changed')].map((m) => m.tag)
    expect(new Set(tags).size).toBe(tags.length)
    // вопрос и ответ — одна переписка, общий tag осознанно
    expect(buildQuestionReplyMessage().tag).toBe(buildQuestionMessage().tag)
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

describe('buildChatMessage', () => {
  it('ссылка на /chat, без текста сообщения, имени автора и названия темы', () => {
    const m = buildChatMessage()
    expect(m.url).toBe('/chat')
    expect(m.title).not.toMatch(/[«»]/)
    expect(`${m.title} ${m.body}`).not.toMatch(/\d/)
  })
})
