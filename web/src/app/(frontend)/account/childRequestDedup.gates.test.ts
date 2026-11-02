import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

// Гейт против рецидива бэклог-п.11: подтверждение заявки создавало `players`
// безусловно, и ребёнок, заведённый импортом, задваивался.
//
// Честная граница этого гейта: он проверяет ПРОВОДКУ (что решение принимается
// проверенным `findDuplicateChild` и что `create` стоит в ветке «дубля нет»), а
// поведение формул — юнит-тесты `lib/playerDedup.test.ts`. Наличие вызова само по
// себе ничего не доказывает (грабли «гейт на строку декоративен»), поэтому здесь
// ещё и разбор места: `create` обязан быть ВНУТРИ блока `else`, а не просто ниже.
const ROUTE = './child-request/respond/route.ts'

const code = (): string =>
  readFileSync(fileURLToPath(new URL(ROUTE, import.meta.url)), 'utf8').replace(/^\s*\/\/.*$/gm, '')

// Индекс закрывающей скобки для блока, открывающегося в `open` (сам `{`).
const closeOf = (src: string, open: number): number => {
  let depth = 0
  for (let i = open; i < src.length; i++) {
    if (src[i] === '{') depth++
    else if (src[i] === '}') {
      depth--
      if (depth === 0) return i
    }
  }
  return -1
}

describe('подтверждение заявки: сверка с существующим ребёнком (бэклог-п.11)', () => {
  it('решение берётся из проверенного модуля, а не из копии в маршруте', () => {
    expect(code()).toMatch(/from '@\/lib\/playerDedup'/)
    expect(code()).toMatch(/findDuplicateChild\(/)
    expect(code()).toMatch(/dedupFill\(/)
  })

  it('создание ребёнка — только в ветке «дубля нет»', () => {
    const src = code()
    const guard = src.search(/if \(duplicate\)/)
    expect(guard).toBeGreaterThan(-1)
    const elseStart = src.indexOf('} else {', guard)
    expect(elseStart).toBeGreaterThan(-1)
    const bodyOpen = elseStart + '} else'.length
    const bodyClose = closeOf(src, bodyOpen)
    expect(bodyClose).toBeGreaterThan(bodyOpen)

    const create = src.search(/payload\.create\(\s*\{\s*collection: 'players'/)
    expect(create).toBeGreaterThan(bodyOpen)
    expect(create).toBeLessThan(bodyClose)
  })

  it('склейка ничего не перетирает: обновление идёт планом dedupFill', () => {
    const src = code()
    const guard = src.search(/if \(duplicate\)/)
    const update = src.search(/payload\.update\(\s*\{\s*collection: 'players'/)
    expect(update).toBeGreaterThan(guard)
    // Обновление существующего ребёнка — под тем же условием, что и guard.
    expect(src.slice(guard, update)).toMatch(/dedupFill\(/)
  })
})
