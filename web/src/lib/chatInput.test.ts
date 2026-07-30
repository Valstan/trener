import { describe, expect, it } from 'vitest'

import { parseMessageCreate, parseTopicCreate } from './chatInput'

describe('parseTopicCreate', () => {
  it('парсит валидный вход и триммит тему', () => {
    expect(parseTopicCreate({ groupId: 3, title: '  Едем на соревнования  ' })).toEqual({
      groupId: 3,
      title: 'Едем на соревнования',
    })
  })

  it('режет тему по лимиту', () => {
    expect(parseTopicCreate({ groupId: 1, title: 'т'.repeat(200) })!.title).toHaveLength(120)
  })

  it('мусор и пустое — null', () => {
    expect(parseTopicCreate(null)).toBeNull()
    expect(parseTopicCreate('x')).toBeNull()
    expect(parseTopicCreate({ groupId: 1 })).toBeNull()
    expect(parseTopicCreate({ groupId: 1, title: '   ' })).toBeNull()
    expect(parseTopicCreate({ groupId: '1', title: 'тема' })).toBeNull()
    expect(parseTopicCreate({ groupId: 0, title: 'тема' })).toBeNull()
    expect(parseTopicCreate({ groupId: 1.5, title: 'тема' })).toBeNull()
  })
})

describe('parseMessageCreate', () => {
  it('парсит сообщение и режет по лимиту', () => {
    expect(parseMessageCreate({ topicId: 2, body: ' привет ' })).toEqual({ topicId: 2, body: 'привет' })
    expect(parseMessageCreate({ topicId: 2, body: 'я'.repeat(5000) })!.body).toHaveLength(2000)
  })

  it('сообщение из одних переносов строки — null, а не пустая реплика', () => {
    expect(parseMessageCreate({ topicId: 2, body: '\n\n\n' })).toBeNull()
    expect(parseMessageCreate({ topicId: 2, body: '  \n \n ' })).toBeNull()
  })

  it('схлопывает лишние пустые строки внутри', () => {
    expect(parseMessageCreate({ topicId: 2, body: 'а\n\n\n\n\nб' })!.body).toBe('а\n\nб')
  })

  it('мусор — null', () => {
    expect(parseMessageCreate({ topicId: -1, body: 'текст' })).toBeNull()
    expect(parseMessageCreate({ body: 'текст' })).toBeNull()
    expect(parseMessageCreate({ topicId: 1, body: 42 })).toBeNull()
  })
})
