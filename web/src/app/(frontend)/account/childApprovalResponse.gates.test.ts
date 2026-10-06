import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

// Гейт против рецидива бэклог-п.10: подтверждение ребёнка игнорировало код ответа —
// 403/404/409 выглядели успехом (безусловный router.refresh()).
// Компонент обязан проверять res.ok и флаг ok из тела и показывать ошибку текстом.
const VIEW = './ChildApprovalRequests.tsx'

const code = (): string =>
  readFileSync(fileURLToPath(new URL(VIEW, import.meta.url)), 'utf8').replace(/^\s*\/\/.*$/gm, '')

describe('подтверждение ребёнка: неуспех виден, а не выглядит успехом', () => {
  it('ответ сервера проверяется (res.ok и флаг ok)', () => {
    expect(code()).toMatch(/res\.ok/)
    expect(code()).toMatch(/data\?\.ok/)
  })

  it('ошибка показывается текстом, кнопки разблокируются', () => {
    expect(code()).toMatch(/setError\(/)
    expect(code()).toMatch(/error-text/)
    expect(code()).toMatch(/setBusy\(null\)/)
  })

  it('безусловного refresh без проверки нет', () => {
    expect(code()).not.toMatch(/\}\s*;\s*router\.refresh\(\)/)
    expect(code()).not.toMatch(/await fetch\([^;]+;\s*router\.refresh\(\)/s)
  })
})
