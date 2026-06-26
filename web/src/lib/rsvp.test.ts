import { describe, it, expect } from 'vitest'

import { rsvpKey, selectReminderParents, summarizeRsvp } from './rsvp'

describe('selectReminderParents', () => {
  it('напоминаем родителям детей без RSVP; ответившие и сироты — мимо', () => {
    const slots = [
      { sessionId: 1, playerId: 10, parentId: 100 }, // нет RSVP → напомнить 100
      { sessionId: 1, playerId: 11, parentId: 100 }, // другой ребёнок 100, RSVP есть → но 100 уже в списке
      { sessionId: 1, playerId: 12, parentId: 200 }, // RSVP есть → не напоминать (если только этот ребёнок)
      { sessionId: 1, playerId: 13, parentId: null }, // сирота → пропуск
    ]
    const responded = new Set([rsvpKey(1, 11), rsvpKey(1, 12)])
    const targets = selectReminderParents(slots, responded)
    expect(targets).toContain(100) // ребёнок 10 без ответа
    expect(targets).not.toContain(200) // единственный ребёнок ответил
    expect(targets).toHaveLength(1)
  })

  it('все ответили → пустой список', () => {
    const slots = [{ sessionId: 2, playerId: 20, parentId: 300 }]
    expect(selectReminderParents(slots, new Set([rsvpKey(2, 20)]))).toEqual([])
  })

  it('дедуп: родитель с двумя неответившими детьми — одно напоминание', () => {
    const slots = [
      { sessionId: 3, playerId: 30, parentId: 400 },
      { sessionId: 3, playerId: 31, parentId: 400 },
    ]
    expect(selectReminderParents(slots, new Set())).toEqual([400])
  })
})

describe('summarizeRsvp', () => {
  it('считает going/notGoing/noResponse от общего числа детей', () => {
    expect(summarizeRsvp(5, ['going', 'going', 'not_going'])).toEqual({
      going: 2,
      notGoing: 1,
      noResponse: 2,
      total: 5,
    })
  })
  it('ответов больше нет → noResponse не уходит в минус', () => {
    expect(summarizeRsvp(2, ['going', 'going', 'going'])).toMatchObject({ going: 3, noResponse: 0 })
  })
})
