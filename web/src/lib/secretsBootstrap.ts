// Восстановление рантайм-секретов из менеджера KARMAN, если локальная копия потеряна.
//
// В НОРМЕ секреты приходят из /etc/trener/trener.env (systemd EnvironmentFile) — и этот
// модуль НИЧЕГО не делает (REQUIRED-ключи на месте → ноль сетевых вызовов). Сетевой путь
// включается ТОЛЬКО как авария: если /etc/trener/trener.env потерян, REQUIRED-ключей в
// process.env нет → тянем секреты из KARMAN (GET по Bearer-токену) и наполняем process.env,
// чтобы приложение всё же поднялось. См. docs/secrets-manager.md.
//
// Best-effort: токена нет или KARMAN недоступен → логируем и НЕ валим старт (поведение
// тогда такое же, как было бы без восстановления — приложение упадёт уже на коннекте к БД).
// SECRETS_TOKEN — единственный bootstrap-секрет; живёт ОТДЕЛЬНО от trener.env
// (/etc/trener/secrets-token.env на проде), иначе он терялся бы вместе с тем, что восстанавливаем.

const DEFAULT_MANAGER_URL = 'https://831d0ce99bdf.vps.myjino.ru/api/secrets'

// Ключи, без которых сервер всё равно не стартует. Их отсутствие = «локальная копия
// потеряна» → триггер восстановления. Этого набора достаточно, чтобы отличить аварию
// от нормального старта (в норме они всегда заданы).
const REQUIRED = ['DATABASE_URL', 'PAYLOAD_SECRET'] as const

export interface BootstrapResult {
  recovered: number
  reason: 'local-env-intact' | 'no-token' | 'recovered' | 'fetch-failed'
}

export async function bootstrapSecretsFromManager(
  env: Record<string, string | undefined> = process.env,
): Promise<BootstrapResult> {
  const missing = REQUIRED.filter((k) => !env[k])
  if (missing.length === 0) return { recovered: 0, reason: 'local-env-intact' }

  const token = env.SECRETS_TOKEN
  if (!token) {
    console.warn(
      `[secrets] локальные секреты потеряны (${missing.join(', ')}), но SECRETS_TOKEN не задан — восстановить из KARMAN нельзя`,
    )
    return { recovered: 0, reason: 'no-token' }
  }

  const url = env.SECRETS_MANAGER_URL ?? DEFAULT_MANAGER_URL
  try {
    const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
    if (!r.ok) throw new Error(`GET ${r.status}`)
    const body = (await r.json()) as { secrets?: Record<string, string> }
    let recovered = 0
    for (const [k, v] of Object.entries(body.secrets ?? {})) {
      if (env[k] === undefined) {
        env[k] = String(v) // не перетираем то, что уже дал systemd
        recovered++
      }
    }
    console.warn(
      `[secrets] восстановлено из KARMAN: ${recovered} секрет(ов) (локальная копия отсутствовала)`,
    )
    return { recovered, reason: 'recovered' }
  } catch (e) {
    console.error(`[secrets] восстановление из KARMAN не удалось: ${(e as Error).message}`)
    return { recovered: 0, reason: 'fetch-failed' }
  }
}
