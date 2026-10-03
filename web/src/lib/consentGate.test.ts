import type { Payload } from 'payload'
import { describe, expect, it, vi } from 'vitest'

import { denyParentWithoutConsent, needsConsent, parentNeedsConsent } from './consentGate'

// Аудит #057, вектор (c) / D-016 §5: гейт согласия стоял ровно в ОДНОМ месте
// (`parent/page.tsx`), поэтому после отзыва согласия родитель прямо вводил адрес и видел
// `/parent/schedule`, `/parent/payments`, `/parent/announcements`, `/chat`; тот же обход
// даёт REST/GraphQL. Теперь три точки: страница, роут и коллекция.

type HookArgs = Parameters<typeof denyParentWithoutConsent>[0]

const payloadWith = (players: number, consents: number): Payload =>
  ({
    count: vi.fn().mockImplementation(({ collection }: { collection: string }) =>
      Promise.resolve({ totalDocs: collection === 'players' ? players : consents }),
    ),
  }) as unknown as Payload

const parent = { id: 7, roles: ['parent'], branch: { id: 3 }, demo: false } as never
const coach = { id: 8, roles: ['coach'], branch: { id: 3 }, demo: false } as never

const makeArgs = (user: unknown, players: number, consents: number): HookArgs =>
  ({
    req: { user, payload: payloadWith(players, consents), t: (s: string) => s },
    overrideAccess: false,
    operation: 'read',
  }) as unknown as HookArgs

/** Родитель с детьми, без активного согласия, обычный (не серверный) вызов. */
const hook = (over: Partial<HookArgs> = {}): HookArgs =>
  ({ ...(makeArgs(parent, 1, 0) as object), ...over }) as HookArgs

describe('нужен ли родителю экран согласия (предикат)', () => {
  it('родитель с детьми, филиалом и без согласия — ДА', () => {
    expect(needsConsent({ parent: true, branchId: 3, playersCount: 2, consentsCount: 0 })).toBe(true)
  })

  it('согласие есть — НЕТ', () => {
    expect(needsConsent({ parent: true, branchId: 3, playersCount: 2, consentsCount: 1 })).toBe(false)
  })

  it('легаси-родитель без филиала — НЕТ (иначе гейт зациклит: экран согласия требует филиала)', () => {
    expect(needsConsent({ parent: true, branchId: null, playersCount: 2, consentsCount: 0 })).toBe(false)
  })

  it('родитель без детей — НЕТ (нечего защищать)', () => {
    expect(needsConsent({ parent: true, branchId: 3, playersCount: 0, consentsCount: 0 })).toBe(false)
  })

  it('не-родитель — НЕТ', () => {
    expect(needsConsent({ parent: false, branchId: 3, playersCount: 2, consentsCount: 0 })).toBe(false)
  })
})

describe('parentNeedsConsent по данным', () => {
  it('считает и детей, и активные согласия', async () => {
    await expect(parentNeedsConsent(payloadWith(2, 0), parent)).resolves.toBe(true)
    await expect(parentNeedsConsent(payloadWith(2, 1), parent)).resolves.toBe(false)
  })

  it('не-родителя не опрашивает вообще (ни одного запроса в БД)', async () => {
    const payload = payloadWith(2, 0)
    await expect(parentNeedsConsent(payload, coach)).resolves.toBe(false)
    expect(payload.count).not.toHaveBeenCalled()
  })
})

describe('REST-гейт: denyParentWithoutConsent', () => {
  it('родитель без согласия и без overrideAccess → Forbidden (REST/GraphQL)', async () => {
    await expect(denyParentWithoutConsent(hook({}))).rejects.toThrow()
  })

  it('тот же родитель с overrideAccess: true проходит — это наш серверный код', async () => {
    // Сид, экспорт, отзыв согласия и сами гейты страниц ходят в БД с overrideAccess:
    // иначе гейт мешал бы сам себе. Снаружи этот флаг недоступен — REST его не читает.
    await expect(denyParentWithoutConsent(hook({ overrideAccess: true }))).resolves.toBeUndefined()
  })

  it('родитель С согласием проходит', async () => {
    await expect(denyParentWithoutConsent(makeArgs(parent, 2, 1))).resolves.toBeUndefined()
  })

  it('тренер/админ проходит: согласие родителя — не его правовое основание', async () => {
    await expect(denyParentWithoutConsent(makeArgs(coach, 2, 0))).resolves.toBeUndefined()
  })

  it('аноним проходит до access-контроля (наш Forbidden — не 403 на пустом месте)', async () => {
    await expect(denyParentWithoutConsent(makeArgs(null, 2, 0))).resolves.toBeUndefined()
  })

  it('гейт НЕ пропускает create/update/delete мимо read (операция не важна — важно решение)', async () => {
    for (const operation of ['create', 'update', 'delete', 'read'] as const) {
      await expect(denyParentWithoutConsent(hook({ operation }))).rejects.toThrow()
    }
  })
})