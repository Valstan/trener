// Next.js instrumentation hook — register() выполняется один раз при старте сервера,
// ДО приёма запросов (значит, до первого импорта payload.config, который читает
// DATABASE_URL/PAYLOAD_SECRET). Здесь — восстановление рантайм-секретов из менеджера
// KARMAN, если локальная копия (/etc/trener/trener.env) потеряна. См. docs/secrets-manager.md.
export async function register() {
  // Только Node-рантайм (не edge): секреты нужны серверной части приложения.
  if (process.env.NEXT_RUNTIME !== 'nodejs') return
  try {
    const { bootstrapSecretsFromManager } = await import('./lib/secretsBootstrap')
    await bootstrapSecretsFromManager()
  } catch (e) {
    // register() не должен ронять старт сервера ни при каких условиях.
    console.error('[secrets] instrumentation register failed:', (e as Error).message)
  }
}
