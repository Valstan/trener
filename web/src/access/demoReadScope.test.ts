import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

// Гейт против рецидива D-029/#166 на ЧТЕНИИ.
//
// #152 закрыл запись: server-mediated роуты перевели с isOwner на isFullOwner /
// staffCanManageGroup. Но страницы (server components) остались на isOwner и читали
// коллекции с overrideAccess без фильтра филиала — 24.08 демо-владелец (публичный
// вход с /demo, roles:['owner']) видел на них живую сеть: email ждущих заявителей,
// список персонала сети с email, имена всех филиалов и групп.
//
// Правило: на этих экранах «сетевой охват» решается ТОЛЬКО isFullOwner, а остальные
// (включая демо-владельца) скоупятся своим филиалом через adminBranchId.
// Тест намеренно смотрит на исходник: логика живёт внутри server component'а,
// который не поднять юнит-тестом без БД, а забыть её легче всего именно при правке
// соседней строки.
const NETWORK_SCOPE_PAGES = [
  'app/(frontend)/coach/requests/page.tsx',
  'app/(frontend)/coach/staff/page.tsx',
  'app/(frontend)/coach/import/page.tsx',
  'app/(frontend)/coach/announcements/page.tsx',
  'app/(frontend)/chat/page.tsx',
]

const src = (rel: string): string =>
  readFileSync(fileURLToPath(new URL(`../${rel}`, import.meta.url)), 'utf8')

describe('демо→живое: экраны персонала скоупятся isFullOwner, а не isOwner', () => {
  it.each(NETWORK_SCOPE_PAGES)('%s решает охват через isFullOwner', (rel) => {
    expect(src(rel)).toMatch(/\bisFullOwner\s*\(/)
  })

  it.each(NETWORK_SCOPE_PAGES)('%s не расширяет выборку по isOwner', (rel) => {
    // Запрещена именно форма «isOwner(user) ? <широкая выборка> : <скоуп>»:
    // роль-гейт `if (!isOwner(user)) redirect('/home')` остаётся законным.
    const code = src(rel).replace(/^\s*\/\/.*$/gm, '')
    expect(code).not.toMatch(/isOwner\s*\(\s*user\s*\)\s*\?/)
    expect(code).not.toMatch(/=\s*isOwner\s*\(\s*user\s*\)\s*$/m)
  })
})
