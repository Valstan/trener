import { describe, it, expect, vi, afterEach } from 'vitest'

import { bootstrapSecretsFromManager } from './secretsBootstrap'

// Контракт восстановления секретов из KARMAN (docs/secrets-manager.md):
//  • happy-path (REQUIRED на месте) → НИ ОДНОГО сетевого вызова;
//  • потеря секретов без токена → не ходим в сеть, мягкий отказ;
//  • потеря секретов с токеном → GET, наполняем недостающее, НЕ перетираем заданное;
//  • KARMAN недоступен → не валим старт.

describe('bootstrapSecretsFromManager', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('ничего не делает, если REQUIRED-ключи уже есть (нет сетевого вызова)', async () => {
    const fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)
    const env: Record<string, string | undefined> = {
      DATABASE_URL: 'x',
      PAYLOAD_SECRET: 'y',
      SECRETS_TOKEN: 't',
    }

    const res = await bootstrapSecretsFromManager(env)

    expect(res).toEqual({ recovered: 0, reason: 'local-env-intact' })
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('не ходит в сеть, если секреты потеряны, но SECRETS_TOKEN не задан', async () => {
    const fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)
    const env: Record<string, string | undefined> = {}

    const res = await bootstrapSecretsFromManager(env)

    expect(res.reason).toBe('no-token')
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('тянет из KARMAN и наполняет недостающее, не перетирая существующее', async () => {
    const fetchSpy = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        secrets: { DATABASE_URL: 'db', PAYLOAD_SECRET: 'ps', CRON_SECRET: 'cs' },
      }),
    })) as unknown as typeof fetch
    vi.stubGlobal('fetch', fetchSpy)
    const env: Record<string, string | undefined> = { SECRETS_TOKEN: 't', CRON_SECRET: 'keep' }

    const res = await bootstrapSecretsFromManager(env)

    expect(res).toEqual({ recovered: 2, reason: 'recovered' }) // DATABASE_URL + PAYLOAD_SECRET
    expect(env.DATABASE_URL).toBe('db')
    expect(env.PAYLOAD_SECRET).toBe('ps')
    expect(env.CRON_SECRET).toBe('keep') // уже было задано → не перетёрто
    expect(fetchSpy).toHaveBeenCalledOnce()
  })

  it('не валит старт, если KARMAN недоступен', async () => {
    const fetchSpy = vi.fn(async () => ({
      ok: false,
      status: 503,
      json: async () => ({}),
    })) as unknown as typeof fetch
    vi.stubGlobal('fetch', fetchSpy)
    const env: Record<string, string | undefined> = { SECRETS_TOKEN: 't' }

    const res = await bootstrapSecretsFromManager(env)

    expect(res).toEqual({ recovered: 0, reason: 'fetch-failed' })
  })

  it('передаёт Bearer-токен в заголовке Authorization', async () => {
    const fetchSpy = vi.fn(async () => ({
      ok: true,
      json: async () => ({ secrets: {} }),
    })) as unknown as typeof fetch
    vi.stubGlobal('fetch', fetchSpy)
    const env: Record<string, string | undefined> = { SECRETS_TOKEN: 'tok123' }

    await bootstrapSecretsFromManager(env)

    const [, init] = (fetchSpy as unknown as ReturnType<typeof vi.fn>).mock.calls[0]
    expect((init as RequestInit).headers).toMatchObject({ Authorization: 'Bearer tok123' })
  })
})
