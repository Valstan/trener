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
// SECRETS_TOKEN + SECRETS_MANAGER_URL — bootstrap-конфиг; живёт ОТДЕЛЬНО от trener.env
// (/etc/trener/secrets-token.env на проде), иначе он терялся бы вместе с тем, что восстанавливаем.
// Адрес менеджера в коде НЕ зашит (D-038: публичный репозиторий — recon-поверхность,
// хостнейм бокса в нём не лежит): нет SECRETS_MANAGER_URL → восстановление невозможно,
// старт не блокируется (как и без токена).
//
// Ретраи (#171, спека vault-client свойство 1): отдельного цикла здесь нет намеренно —
// это аварийный путь, и повторный поход даёт сам systemd: неудача → старт без секретов
// → падение на коннекте к БД → Restart=on-failure через RestartSec → register() снова.
// Комната — КОПИЯ, источник истины — env бокса, поэтому «один поход за жизнь процесса»
// мины #171 не создаёт (ни один секрет не живёт только в комнате).

// Висящий KARMAN не должен держать старт: предупредили и пошли дальше
// (без сигнала fetch ждал бы системный таймаут сокета).
const FETCH_TIMEOUT_MS = 5_000

// Ключи, без которых сервер всё равно не стартует. Их отсутствие = «локальная копия
// потеряна» → триггер восстановления. Этого набора достаточно, чтобы отличить аварию
// от нормального старта (в норме они всегда заданы).
const REQUIRED = ['DATABASE_URL', 'PAYLOAD_SECRET'] as const

// Какие имена клиент согласен принять из KARMAN. Всё прочее — игнорировать: авторизация
// хранилища проверяет ИСТОЧНИК запроса, но цель (имя переменной) выбирает содержимое
// комнаты. Без allowlist подложенный в комнату NODE_OPTIONS/LD_PRELOAD уехал бы прямо
// в process.env = исполнение чужого кода на проде. Спека: brain_matrica
// docs/specs/vault-client.md. SECRETS_TOKEN и SECRETS_MANAGER_URL здесь НЕ место:
// bootstrap-конфиг не восстанавливают из хранилища, которое им же адресуется.
// Новый рантайм-секрет в web/.env.example → добавить и сюда.
const ALLOWED = new Set<string>([
  ...REQUIRED,
  'NEXT_PUBLIC_SERVER_URL',
  'NEXT_PUBLIC_VAPID_PUBLIC_KEY',
  'VAPID_PRIVATE_KEY',
  'VAPID_SUBJECT',
  'CRON_SECRET',
  'SMTP_HOST',
  'SMTP_PORT',
  'SMTP_USER',
  'SMTP_PASS',
  'SMTP_FROM_ADDRESS',
  'SMTP_FROM_NAME',
  'SMTP_SECURE',
  'RADAR_ISSUER_URL',
  'RADAR_CLIENT_ID',
  'RADAR_CLIENT_SECRET',
  'RADAR_REDIRECT_URI',
])

export interface BootstrapResult {
  recovered: number
  reason: 'local-env-intact' | 'no-token' | 'no-manager-url' | 'recovered' | 'fetch-failed'
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

  const url = env.SECRETS_MANAGER_URL
  if (!url) {
    console.warn(
      `[secrets] локальные секреты потеряны (${missing.join(', ')}), но SECRETS_MANAGER_URL не задан — восстановить из KARMAN нельзя`,
    )
    return { recovered: 0, reason: 'no-manager-url' }
  }
  try {
    const r = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    })
    if (!r.ok) throw new Error(`GET ${r.status}`)
    const body = (await r.json()) as { secrets?: Record<string, string> }
    let recovered = 0
    const ignored: string[] = []
    for (const [k, v] of Object.entries(body.secrets ?? {})) {
      if (!ALLOWED.has(k)) {
        ignored.push(k)
        continue
      }
      if (env[k] === undefined) {
        env[k] = String(v) // не перетираем то, что уже дал systemd
        recovered++
      }
    }
    if (ignored.length > 0) {
      // Только имена, не значения. Чужой ключ в комнате — сигнал разбираться, чей он.
      console.warn(`[secrets] проигнорированы ключи вне allowlist: ${ignored.join(', ')}`)
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
