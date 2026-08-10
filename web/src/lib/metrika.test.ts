import { describe, expect, it } from 'vitest'

import { METRIKA_COUNTER_ID, metrikaSnippet } from './metrika'

// Регрессия 10.08: сниппет счётчика ломается молча — страница рендерится,
// tag.js отдаётся с 200, а просмотры не уходят и в кабинете вечный ноль.
// Единственное, что отделяет рабочий счётчик от мёртвого, — `?id=` в src.
describe('metrikaSnippet', () => {
  it('грузит tag.js С параметром ?id= — без него очередь ym.a не разбирается', () => {
    expect(metrikaSnippet(111457538)).toContain(
      "'https://mc.yandex.ru/metrika/tag.js?id=111457538'",
    )
  })

  it('инициализирует тот же счётчик, что и грузит', () => {
    const snippet = metrikaSnippet(4242)
    expect(snippet).toContain('tag.js?id=4242')
    expect(snippet).toContain("ym(4242,'init'")
  })

  it('не тянет Вебвизор: он выключен в кабинете, в коде его тоже быть не должно', () => {
    expect(metrikaSnippet(1)).not.toContain('webvisor')
  })
})

describe('METRIKA_COUNTER_ID', () => {
  it('заведён — иначе счётчик и информер не рендерятся вовсе', () => {
    expect(METRIKA_COUNTER_ID).toBe(111457538)
  })
})
