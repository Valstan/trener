import { describe, expect, it } from 'vitest'

import { validateScorersGroup } from './matches'

// Правило «гол может забить только ребёнок из группы этого матча» (#057, векторы b, f).
//
// У этого правила НЕ БЫЛО тестов — и оно молча отвергало любую запись гола: на вложенном
// поле `scorers[].player` в payload 3.90.1 siblingData не содержит полей матча, проверка
// получала group = null и возвращала «Сначала укажите группу матча». Поймал падающий
// ночной демо-сид, а не тест. Отсюда правило проверки: правило, которое может отвергнуть
// ЛЮБУЮ запись, обязано иметь тест — иначе оно стреляет в прод молча.
describe('validateScorersGroup', () => {
  const players = new Map<number, number | null>([
    [10, 5], // ребёнок из группы 5
    [11, 6], // ребёнок из чужой группы
  ])

  it('гол ребёнка из группы матча — принимается', () => {
    expect(validateScorersGroup([{ player: 10, goals: 2 }], 5, players)).toBe(true)
  })

  it('гол ребёнка из ЧУЖОЙ группы — отвергается (имя не утечёт родителям другой ветки)', () => {
    expect(validateScorersGroup([{ player: 11, goals: 1 }], 5, players)).toBe(
      'Гол может забить только ребёнок из группы этого матча.',
    )
  })

  it('смешанный список: одно нарушение — отвергаем весь список', () => {
    expect(validateScorersGroup([{ player: 10, goals: 1 }, { player: 11, goals: 1 }], 5, players)).toBe(
      'Гол может забить только ребёнок из группы этого матча.',
    )
  })

  it('группа матча не указана — внятная ошибка, а не «проверка мимо»', () => {
    // Именно этот случай и срабатывал на сиде: без явной проверки сообщение выглядело бы
    // как «поле невалидно», и причина была бы неочевидна.
    expect(validateScorersGroup([{ player: 10, goals: 1 }], null, players)).toBe(
      'Сначала укажите группу матча.',
    )
    expect(validateScorersGroup([{ player: 10, goals: 1 }], undefined, players)).toBe(
      'Сначала укажите группу матча.',
    )
  })

  it('группа приходит объектом ({ id }) — тоже принимается', () => {
    expect(validateScorersGroup([{ player: { id: 10 }, goals: 1 }], { id: 5 }, players)).toBe(true)
  })

  it('пустой список и не-массив — пропускаем (нечего проверять)', () => {
    expect(validateScorersGroup([], null, players)).toBe(true)
    expect(validateScorersGroup(null, 5, players)).toBe(true)
    expect(validateScorersGroup(undefined, 5, players)).toBe(true)
  })

  it('игрок без группы в справочнике — не пропускаем молча', () => {
    // Отсутствие записи о группе ребёнка = его группа неизвестна; пропустить такой гол
    // означало бы вернуть дыру, которую правило и закрывает.
    expect(validateScorersGroup([{ player: 99, goals: 1 }], 5, players)).toBe(
      'Гол может забить только ребёнок из группы этого матча.',
    )
  })
})