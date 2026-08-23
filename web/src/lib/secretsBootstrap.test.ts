import { describe, it, expect, vi, afterEach } from 'vitest'

import { bootstrapSecretsFromManager } from './secretsBootstrap'

// Контракт восстановления секретов из KARMAN (docs/secrets-manager.md):
//  • happy-path (REQUIRED на месте) → НИ ОДНОГО сетевого вызова;
//  • потеря секретов без токена → не ходим в сеть, мягкий отказ;
//  • потеря секретов с токеном → GET, наполняем недостающее, НЕ перетираем заданное;
//  • KARMAN недоступен → не валим старт;
//  • в env попадают ТОЛЬКО ключи из allowlist — цель выбирает клиент, а не хранилище
//    (иначе комната могла бы подложить NODE_OPTIONS/LD_PRELOAD = RCE на проде);
//  • запрос с таймаутом: висящий KARMAN не держит старт;
//  • адрес менеджера ТОЛЬКО из env (D-038: хостнейм бокса в коде не зашит) —
//    без SECRETS_MANAGER_URL в сеть не ходим.

// Адрес в тестах — заведомо несуществующий: дефолта в коде нет, fetch застаблен.
const MANAGER_URL = 'https://vault.invalid/api/secrets'

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

  it('не ходит в сеть, если секреты потеряны, токен есть, но SECRETS_MANAGER_URL не задан', async () => {
    const fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)
    const env: Record<string, string | undefined> = { SECRETS_TOKEN: 't' }

    const res = await bootstrapSecretsFromManager(env)

    expect(res).toEqual({ recovered: 0, reason: 'no-manager-url' })
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
    const env: Record<string, string | undefined> = { SECRETS_TOKEN: 't', SECRETS_MANAGER_URL: MANAGER_URL, CRON_SECRET: 'keep' }

    const res = await bootstrapSecretsFromManager(env)

    expect(res).toEqual({ recovered: 2, reason: 'recovered' }) // DATABASE_URL + PAYLOAD_SECRET
    expect(env.DATABASE_URL).toBe('db')
    expect(env.PAYLOAD_SECRET).toBe('ps')
    expect(env.CRON_SECRET).toBe('keep') // уже было задано → не перетёрто
    expect(fetchSpy).toHaveBeenCalledOnce()
    expect((fetchSpy as unknown as ReturnType<typeof vi.fn>).mock.calls[0][0]).toBe(MANAGER_URL)
  })

  it('не валит старт, если KARMAN недоступен', async () => {
    const fetchSpy = vi.fn(async () => ({
      ok: false,
      status: 503,
      json: async () => ({}),
    })) as unknown as typeof fetch
    vi.stubGlobal('fetch', fetchSpy)
    const env: Record<string, string | undefined> = { SECRETS_TOKEN: 't', SECRETS_MANAGER_URL: MANAGER_URL }

    const res = await bootstrapSecretsFromManager(env)

    expect(res).toEqual({ recovered: 0, reason: 'fetch-failed' })
  })

  it('НЕ кладёт в env ключи вне allowlist (негативный прогон #114)', async () => {
    const fetchSpy = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        secrets: {
          DATABASE_URL: 'db',
          NODE_OPTIONS: '--require /tmp/evil.js',
          LD_PRELOAD: '/tmp/evil.so',
          SOME_FUTURE_KEY: 'x',
        },
      }),
    })) as unknown as typeof fetch
    vi.stubGlobal('fetch', fetchSpy)
    const env: Record<string, string | undefined> = { SECRETS_TOKEN: 't', SECRETS_MANAGER_URL: MANAGER_URL }

    const res = await bootstrapSecretsFromManager(env)

    expect(env.DATABASE_URL).toBe('db')
    expect(env.NODE_OPTIONS).toBeUndefined()
    expect(env.LD_PRELOAD).toBeUndefined()
    expect(env.SOME_FUTURE_KEY).toBeUndefined()
    expect(res.recovered).toBe(1) // только DATABASE_URL
  })

  it('не принимает из KARMAN собственный bootstrap-конфиг (SECRETS_MANAGER_URL)', async () => {
    const fetchSpy = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        secrets: { DATABASE_URL: 'db', PAYLOAD_SECRET: 'ps', SECRETS_MANAGER_URL: 'https://evil.example' },
      }),
    })) as unknown as typeof fetch
    vi.stubGlobal('fetch', fetchSpy)
    const env: Record<string, string | undefined> = { SECRETS_TOKEN: 't', SECRETS_MANAGER_URL: MANAGER_URL }

    await bootstrapSecretsFromManager(env)

    expect(env.SECRETS_MANAGER_URL).toBe(MANAGER_URL) // не подменён значением из комнаты
  })

  it('передаёт AbortSignal (таймаут) в запрос к KARMAN', async () => {
    const fetchSpy = vi.fn(async () => ({
      ok: true,
      json: async () => ({ secrets: {} }),
    })) as unknown as typeof fetch
    vi.stubGlobal('fetch', fetchSpy)
    const env: Record<string, string | undefined> = { SECRETS_TOKEN: 't', SECRETS_MANAGER_URL: MANAGER_URL }

    await bootstrapSecretsFromManager(env)

    const [, init] = (fetchSpy as unknown as ReturnType<typeof vi.fn>).mock.calls[0]
    expect((init as RequestInit).signal).toBeInstanceOf(AbortSignal)
  })

  it('обрыв по таймауту не валит старт (fetch reject → fetch-failed)', async () => {
    const fetchSpy = vi.fn(async () => {
      throw new DOMException('The operation was aborted due to timeout', 'TimeoutError')
    }) as unknown as typeof fetch
    vi.stubGlobal('fetch', fetchSpy)
    const env: Record<string, string | undefined> = { SECRETS_TOKEN: 't', SECRETS_MANAGER_URL: MANAGER_URL }

    const res = await bootstrapSecretsFromManager(env)

    expect(res).toEqual({ recovered: 0, reason: 'fetch-failed' })
  })

  it('передаёт Bearer-токен в заголовке Authorization', async () => {
    const fetchSpy = vi.fn(async () => ({
      ok: true,
      json: async () => ({ secrets: {} }),
    })) as unknown as typeof fetch
    vi.stubGlobal('fetch', fetchSpy)
    const env: Record<string, string | undefined> = { SECRETS_TOKEN: 'tok123', SECRETS_MANAGER_URL: MANAGER_URL }

    await bootstrapSecretsFromManager(env)

    const [, init] = (fetchSpy as unknown as ReturnType<typeof vi.fn>).mock.calls[0]
    expect((init as RequestInit).headers).toMatchObject({ Authorization: 'Bearer tok123' })
  })
})
