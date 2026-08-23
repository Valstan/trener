import { describe, expect, it, vi } from 'vitest'

// Роут-уровневый юнит-тест демо-гарда импорта (D-029/#166, belt-and-suspenders к
// D-016-гейту applyImport). payload.init не поднимаем: getPayload/@payload-config и
// почтовый модуль замоканы — проверяем ровно диспетчер route.ts (ту же школу, что
// «чистая логика без БД» в vitest.config), а не Postgres.
vi.mock('@payload-config', () => ({ default: {} }))

// vi.hoisted: фабрики vi.mock подняты в начало файла, поэтому шпионы, на которые они
// ссылаются, должны существовать так же рано.
const { sendPlayerJoinEmail, auth } = vi.hoisted(() => ({
  sendPlayerJoinEmail: vi.fn(),
  auth: vi.fn(),
}))
vi.mock('@/lib/email/magicLinkEmail', () => ({ sendPlayerJoinEmail }))
vi.mock('payload', () => ({
  getPayload: vi.fn(async () => ({ auth, logger: { info: vi.fn(), error: vi.fn() } })),
}))

import { POST } from './route'

const post = (body: unknown): Request =>
  new Request('http://localhost/coach/import/run', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })

describe('coach/import/run — демо-гард (D-029/#166)', () => {
  it('демо-владелец → 400 errorCode=demo, applyImport не достигается, письмо не уходит', async () => {
    auth.mockResolvedValue({ user: { id: 1, roles: ['owner'], demo: true } })
    const res = await POST(post({ mode: 'apply', rows: [{ name: 'Петя', groupId: 1 }], sendEmails: true }))
    expect(res.status).toBe(400)
    expect(await res.json()).toMatchObject({ ok: false, errorCode: 'demo' })
    // Ключевая гарантия: приглашение родителю из публичной витрины не рассылается.
    expect(sendPlayerJoinEmail).not.toHaveBeenCalled()
  })

  it('живой владелец не отсекается демо-гардом (идёт дальше обычной валидацией)', async () => {
    auth.mockResolvedValue({ user: { id: 1, roles: ['owner'] } })
    // Пустой чанк → 400 errorCode=input ПОСЛЕ гарда: доказывает, что гард демо-специфичен
    // (иначе был бы errorCode=demo), не блокирует живого владельца.
    const res = await POST(post({ mode: 'apply', rows: [] }))
    expect(res.status).toBe(400)
    expect(await res.json()).toMatchObject({ errorCode: 'input' })
    expect(sendPlayerJoinEmail).not.toHaveBeenCalled()
  })
})
