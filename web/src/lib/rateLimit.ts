// Простейший in-memory rate limit для публичных эндпоинтов.
//
// Аудит #057 (векторы a, c, f): ни в приложении, ни в конфигурации обратного прокси
// (она вне репо) ограничения частоты не было. Последствия, которые мы закрываем здесь:
//   - почтовый релей школы как relay для произвольных адресов (request-login/register/
//     accept-invite), плюс рост login-tokens и users;
//   - бесплатная фабрика сессий на POST /demo/login;
//   - дешёвый DoS по любому тяжёлому маршруту.
//
// Сознательные ограничения решения:
//   - память процесса, не общая: при нескольких инстансах лимит умножается на число
//     инстансов (у нас один standalone-процесс, это не расходится с продом);
//   - счётчик скользящее окно, без внешнего хранилища: сброс при рестарте приемлем —
//     это защита от массового, а не от целенаправленного;
//   - ключ по IP из x-forwarded-for: за прокси это единственный доступный идентификатор
//     (см. замечание про clientMeta в lib/requestMeta.ts — там та же оговорка про
//     подделываемость заголовка; здесь цена ошибки — не более одного лишнего запроса).
//
// Класс вызывается ДО любой работы с БД и до отправки письма, чтобы ограничение
// стоило одинаково независимо от того, существует адрес или нет.

type Bucket = { count: number; firstAt: number }

const buckets = new Map<string, Bucket>()

// Периодическая чистка, иначе карта растёт бесконечно (один ключ на каждый запрошенный
// IP). Модуль выполняется один раз на процесс.
const SWEEP_INTERVAL_MS = 60_000
let lastSweep = Date.now()

const sweep = (now: number): void => {
  if (now - lastSweep < SWEEP_INTERVAL_MS) return
  lastSweep = now
  for (const [key, bucket] of buckets) {
    if (now - bucket.firstAt > 60 * 60_000) buckets.delete(key)
  }
}

export const clientIp = (req: Request): string => {
  const fwd = req.headers.get('x-forwarded-for') ?? ''
  const first = (fwd.split(',')[0] ?? '').trim()
  if (first) return first
  return (req.headers.get('x-real-ip') ?? '').trim() || 'unknown'
}

/**
 * @returns true — запрос в пределах лимита (можно обрабатывать);
 *          false — лимит исчерпан, отвечайте 429.
 */
export const rateLimit = (
  req: Request,
  { name, limit, windowMs }: { name: string; limit: number; windowMs: number },
): boolean => {
  const now = Date.now()
  sweep(now)
  const key = `${name}:${clientIp(req)}`
  const bucket = buckets.get(key)
  if (!bucket || now - bucket.firstAt > windowMs) {
    buckets.set(key, { count: 1, firstAt: now })
    return true
  }
  if (bucket.count >= limit) return false
  bucket.count += 1
  return true
}
