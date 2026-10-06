import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

// Гейт против рецидива бэклог-п.6: пустая волна 0/0 показывала «Все подтвердили —
// отлично.» (ложно-зелёный на экране, который и делался против ложно-зелёных).
//
// Вердикт считает чистая coverageVerdict(summary) с юнит-тестами; этот гейт держит
// проводку: компонент обязан звать её от summary и иметь ветку 'empty' с честным
// текстом, а старая форма «pending пуст → успех» обязана отсутствовать.
const VIEW = '../app/(frontend)/coach/session/[id]/CoverageView.tsx'

const code = (): string =>
  readFileSync(fileURLToPath(new URL(VIEW, import.meta.url)), 'utf8').replace(/^\s*\/\/.*$/gm, '')

describe('coverage: пустая волна не выглядит подтверждённой', () => {
  it('вердикт считается от summary через coverageVerdict', () => {
    expect(code()).toMatch(/coverageVerdict\s*\(\s*summary\s*\)/)
  })

  it('трёхходовой вердикт с честным текстом в else-ветке', () => {
    expect(code()).toMatch(/verdict === 'pending'/)
    expect(code()).toMatch(/verdict === 'done'/)
    expect(code()).toMatch(/не ушло никому/)
  })

  it('старой формы «pending пуст → успех» нет', () => {
    expect(code()).not.toMatch(/Все подтвердили — отлично\.<\/p>\s*\)\s*\}/)
    expect(code()).not.toContain('summary.pending.length === 0')
  })
})
