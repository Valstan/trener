import { describe, expect, it, vi } from 'vitest'
import type { Payload } from 'payload'

import { applyImport, previewImport } from './importPlayers'

// Оркестратор импорта с мок-payload: скоуп по ролям, дедуп против БД, ре-валидация
// apply (TOCTOU), честный построчный отчёт, транзит email (152-ФЗ).

type MockArgs = {
  collection?: string
  where?: Record<string, { equals?: unknown; in?: unknown[] }>
  data?: Record<string, unknown>
}
type MockGroup = { id: number; name: string; branch?: number; coaches?: number[] }
type MockPlayer = { id: number; name: string; group: number; parent?: number | null }

const mkPayload = (opts: {
  groups?: MockGroup[]
  players?: MockPlayer[]
  failCreateNames?: string[]
  smtpDown?: boolean
} = {}) => {
  let nextId = 1000
  const find = vi.fn(async (args: MockArgs) => {
    if (args.collection === 'groups') {
      // Фильтруем как настоящий Payload: скоуп-тесты зависят от where.
      let docs = opts.groups ?? []
      const branchEq = args.where?.branch?.equals
      if (branchEq != null) docs = docs.filter((g) => g.branch === branchEq)
      const coachesIn = args.where?.coaches?.in
      if (coachesIn) docs = docs.filter((g) => (g.coaches ?? []).some((c) => coachesIn.includes(c)))
      return { docs }
    }
    if (args.collection === 'players') return { docs: opts.players ?? [] }
    return { docs: [] }
  })
  const create = vi.fn(async (args: MockArgs) => {
    if (args.collection === 'players' && opts.failCreateNames?.includes(String(args.data?.name))) {
      throw new Error('db down')
    }
    return { id: ++nextId, ...args.data }
  })
  const sendEmail = vi.fn(async () => {
    if (opts.smtpDown) throw new Error('SMTP не настроен')
  })
  const logger = { info: vi.fn(), error: vi.fn() }
  const payload = { find, create, sendEmail, logger } as unknown as Payload
  const playerCreates = () => create.mock.calls.filter(([a]) => a.collection === 'players')
  const tokenCreates = () => create.mock.calls.filter(([a]) => a.collection === 'login-tokens')
  return { payload, find, create, sendEmail, playerCreates, tokenCreates }
}

const OWNER = { id: 1, roles: ['owner'] }
const ADMIN7 = { id: 2, roles: ['admin'], branch: 7 }
const COACH = { id: 3, roles: ['coach'] }

const GROUPS: MockGroup[] = [
  { id: 1, name: 'Старшая', branch: 7, coaches: [3] },
  { id: 2, name: 'Младшая', branch: 7, coaches: [3] },
  { id: 3, name: 'Чужая', branch: 8, coaches: [9] },
]

describe('previewImport — скоуп и матчинг групп', () => {
  it('coach: группа вне его списка → group-not-found, ничего не пишется', async () => {
    const m = mkPayload({ groups: GROUPS })
    const res = await previewImport(m.payload, COACH, { text: 'Петя;Чужая' })
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.rows[0]).toMatchObject({ status: 'error', errorCode: 'group-not-found' })
    expect(m.create).not.toHaveBeenCalled()
  })

  it('owner без branchId → branch-required', async () => {
    const m = mkPayload({ groups: GROUPS })
    expect(await previewImport(m.payload, OWNER, { text: 'Петя;Старшая' })).toEqual({
      ok: false,
      errorCode: 'branch-required',
    })
  })

  it('admin: чужой branchId отклоняется (fail-closed)', async () => {
    const m = mkPayload({ groups: GROUPS })
    expect(await previewImport(m.payload, ADMIN7, { text: 'Петя;Старшая', branchId: 8 })).toEqual({
      ok: false,
      errorCode: 'forbidden',
    })
  })

  it('две группы скоупа с одним нормализованным именем → group-ambiguous', async () => {
    const m = mkPayload({
      groups: [
        { id: 1, name: 'Старшая', branch: 7 },
        { id: 5, name: ' СТАРШАЯ ', branch: 7 },
      ],
    })
    const res = await previewImport(m.payload, ADMIN7, { text: 'Петя;Старшая' })
    if (!res.ok) throw new Error('ожидали ok')
    expect(res.rows[0]).toMatchObject({ status: 'error', errorCode: 'group-ambiguous' })
  })

  it('дедуп против БД: без родителя → exists, с родителем → linked, новый → create', async () => {
    const m = mkPayload({
      groups: GROUPS,
      players: [
        { id: 50, name: 'Петя Иванов', group: 1, parent: null },
        { id: 51, name: 'Вася', group: 1, parent: 99 },
      ],
    })
    const res = await previewImport(m.payload, ADMIN7, {
      text: 'Петя  Иванов;Старшая\nВася;Старшая\nНовый;Старшая',
    })
    if (!res.ok) throw new Error('ожидали ok')
    expect(res.rows.map((r) => r.status)).toEqual(['exists', 'linked', 'create'])
    expect(res.summary).toEqual({ create: 1, exists: 1, linked: 1, errors: 0 })
  })
})

describe('applyImport — ре-валидация, идемпотентность, отчёт', () => {
  it('apply ре-валидирует: подсунутый чужой groupId → ошибка строки, create не вызван', async () => {
    const m = mkPayload({ groups: GROUPS })
    const res = await applyImport(m.payload, COACH, { rows: [{ name: 'Петя', groupId: 3 }] })
    if (!res.ok) throw new Error('ожидали ok')
    expect(res.rows[0]).toMatchObject({ status: 'error', errorCode: 'group-not-found' })
    expect(m.create).not.toHaveBeenCalled()
  })

  it('существующий без родителя → НЕ создаём, но перевыпускаем ссылку; с родителем → пропуск без ссылки', async () => {
    const m = mkPayload({
      groups: GROUPS,
      players: [
        { id: 50, name: 'Петя Иванов', group: 1, parent: null },
        { id: 51, name: 'Вася', group: 1, parent: 99 },
      ],
    })
    const res = await applyImport(m.payload, ADMIN7, {
      rows: [
        { name: 'Петя Иванов', groupId: 1 },
        { name: 'Вася', groupId: 1 },
        { name: 'Новый', groupId: 1 },
      ],
    })
    if (!res.ok) throw new Error('ожидали ok')
    expect(res.rows.map((r) => r.status)).toEqual(['exists', 'linked', 'create'])
    expect(res.rows[0].joinUrl).toContain('/join/')
    expect(res.rows[1].joinUrl).toBeUndefined()
    // Создан только «Новый»; токены — для exists и create (2 шт.).
    expect(m.playerCreates()).toHaveLength(1)
    expect(m.tokenCreates()).toHaveLength(2)
    expect(res.summary).toMatchObject({ created: 1, links: 2, reissued: 1, errors: 0 })
  })

  it('дубль внутри чанка → error duplicate, второй раз не создаём', async () => {
    const m = mkPayload({ groups: GROUPS })
    const res = await applyImport(m.payload, ADMIN7, {
      rows: [
        { name: 'Петя', groupId: 1 },
        { name: ' ПЕТЯ ', groupId: 1 },
      ],
    })
    if (!res.ok) throw new Error('ожидали ok')
    expect(res.rows.map((r) => r.status)).toEqual(['create', 'error'])
    expect(res.rows[1].errorCode).toBe('duplicate')
    expect(m.playerCreates()).toHaveLength(1)
  })

  it('падение create на строке 2 из 3 → строки 1 и 3 созданы, отчёт честный', async () => {
    const m = mkPayload({ groups: GROUPS, failCreateNames: ['Вася'] })
    const res = await applyImport(m.payload, ADMIN7, {
      rows: [
        { name: 'Петя', groupId: 1 },
        { name: 'Вася', groupId: 1 },
        { name: 'Коля', groupId: 2 },
      ],
    })
    if (!res.ok) throw new Error('ожидали ok')
    expect(res.rows.map((r) => r.status)).toEqual(['create', 'error', 'create'])
    expect(res.rows[1].errorCode).toBe('create-failed')
    expect(m.tokenCreates()).toHaveLength(2)
    expect(res.summary).toMatchObject({ created: 2, errors: 1 })
  })

  it('SMTP лежит → emailStatus failed, импорт НЕ падает; email не попадает в players (152-ФЗ)', async () => {
    const m = mkPayload({ groups: GROUPS, smtpDown: true })
    const res = await applyImport(m.payload, ADMIN7, {
      rows: [{ name: 'Новый', groupId: 1, email: 'mama@mail.ru' }],
      sendEmails: true,
    })
    if (!res.ok) throw new Error('ожидали ok')
    expect(res.rows[0]).toMatchObject({ status: 'create', emailStatus: 'failed' })
    expect(res.rows[0].joinUrl).toContain('/join/')
    // 152-ФЗ-ассерт: в create players уходят РОВНО name + group, никакого email.
    for (const [args] of m.playerCreates()) {
      expect(Object.keys(args.data ?? {}).sort()).toEqual(['group', 'name'])
    }
  })

  it('SMTP живой → emailStatus sent и счётчик писем; кривой email → none, письмо не шлём', async () => {
    const m = mkPayload({ groups: GROUPS })
    const res = await applyImport(m.payload, ADMIN7, {
      rows: [
        { name: 'Новый', groupId: 1, email: 'mama@mail.ru' },
        { name: 'Второй', groupId: 1, email: 'без-собаки' },
      ],
      sendEmails: true,
    })
    if (!res.ok) throw new Error('ожидали ok')
    expect(res.rows.map((r) => r.emailStatus)).toEqual(['sent', 'none'])
    expect(m.sendEmail).toHaveBeenCalledTimes(1)
    expect(res.summary.emailsSent).toBe(1)
  })
})
