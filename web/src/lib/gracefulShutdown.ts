// SIGTERM-drain (профилактика G234, письмо Мозга 2026-08-08).
//
// Замер на боксе 09.08: в standalone-артефакте Next 15.4.11 обработчика SIGTERM
// НЕТ ВООБЩЕ (`grep -c SIGTERM server.js` → 0). Значит дефолт Node: процесс
// завершается немедленно, разрывая запросы в полёте. У нас деплой = `systemctl
// restart` после КАЖДОГО мержа — то есть каждый выкат бьёт по активным запросам
// (симптом G234: 502 у случайного пользователя при пустых логах приложения).
//
// Реализация без обёртки над server.js: Next не даёт хука к http-серверу, но даёт
// instrumentation.register() — там мы перехватываем сигнал и ОТКЛАДЫВАЕМ выход на
// DRAIN_MS. За это окно активные запросы (обычные — доли секунды) успевают
// ответить, после чего процесс выходит сам. systemd ждёт TimeoutStopSec (90 c по
// умолчанию) — с запасом.
//
// Почему не полноценный graceful close сокетов: до объекта сервера из instrumentation
// не дотянуться, а костыль с перебором хендлов хрупче задержки. Пауза решает ту же
// задачу — не рвать то, что уже в работе.
export const DRAIN_MS = Number(process.env.SHUTDOWN_DRAIN_MS ?? 5000)

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
