// SIGTERM-drain (профилактика G234, письмо Мозга 2026-08-08; поправка 2026-08-23).
//
// Поправка (G234 амендмент-2): вывод замера 09.08 «в standalone-артефакте обработчика
// SIGTERM нет — grep по server.js дал 0» был ЛОЖНЫМ МИНУСОМ. Обработчик приходит из
// фреймворка (`next/dist/server/lib/start-server.js`, под `if (!NEXT_MANUAL_SIG_HANDLE)`)
// и в нашем бандле его быть не должно; наличие проверяется фактом —
// `process.listenerCount('SIGTERM') > 1` после register(). Обработчик Next делает
// `server.close()` и выходит, когда запросы в полёте доответили; idle keep-alive он
// НЕ закрывает — но у нас прокси не держит пул к бэкенду, так что висеть нечему.
// Штатный выход — код 0; код 143 означал бы, что обработчик НЕ отработал.
//
// Наш дренаж — страховка поверх фреймворка: instrumentation.register() перехватывает
// сигнал и ОТКЛАДЫВАЕТ выход на DRAIN_MS, чтобы активные запросы (обычные — доли
// секунды) успели ответить. Таймер unref'нут: если Next завершит процесс раньше,
// мы не держим его. systemd ждёт TimeoutStopSec — с запасом над окном.
//
// Почему не полноценный graceful close сокетов: до объекта сервера из instrumentation
// не дотянуться, а костыль с перебором хендлов хрупче задержки. Рецепт с обёрткой
// вне бандла (подмена http.createServer) — в пуле Мозга, понадобится только при
// появлении idle-пула у прокси.
const DRAIN_MS = Number(process.env.SHUTDOWN_DRAIN_MS ?? 5000)

let armed = false

export const armGracefulShutdown = (): void => {
  if (armed) return
  armed = true
  for (const signal of ['SIGTERM', 'SIGINT'] as const) {
    process.on(signal, () => {
      console.log(`[shutdown] ${signal}: дренаж ${DRAIN_MS} мс перед выходом`)
      setTimeout(() => process.exit(0), DRAIN_MS).unref?.()
    })
  }
}
