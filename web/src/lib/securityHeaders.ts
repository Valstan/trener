// ── Заголовки безопасности ───────────────────────────────────────────────────
//
// До 14.09.2026 приложение не отдавало НИ ОДНОГО: ни CSP, ни HSTS, ни nosniff
// (`curl -sI` по проду). nginx перед приложением своих не добавляет — то есть их не
// было вовсе, а не «ставятся уровнем выше». Нашёл Мозг снаружи; рецепт — от портала
// вМалмыже (их PR #84, письмо `2026-09-12-g311-form-action-added-with-esa-origin…`).
//
// Живёт отдельным модулем, а не внутри next.config.ts, чтобы тест мог импортировать
// список, не выполняя `withPayload()` со всей сборочной обвязкой.

export type SecurityHeader = { key: string; value: string }

export const securityHeaders: SecurityHeader[] = [
  // CSP намеренно БЕЗ `script-src`/`style-src`: админка Payload и счётчик Метрики
  // живут на inline-скриптах, полная CSP с nonce — отдельная работа с отдельной
  // приёмкой. Три директивы ниже не требуют nonce и закрывают три разных класса:
  //   frame-ancestors — кликджекинг (нас не засунуть в чужой iframe);
  //   form-action     — куда вообще разрешено отправлять формы;
  //   base-uri        — подмена <base> инъекцией, ломающая все относительные пути.
  //
  // ⚠️ У портала в `form-action` рядом с 'self' стоит origin ЕСА: их выход — POST-форма,
  // отвечающая 303 на `end_session` центра авторизации, и без origin CSP её бы сломала.
  // У НАС такого потока нет и origin ЕСА здесь намеренно отсутствует: выход — `fetch`
  // на `/api/users/logout` (LogoutButton.tsx), вход через Радар — обычная GET-ссылка
  // `<a href="/auth/vk/start">` (form-action к навигации не применяется), а все формы
  // приложения отправляются на свой же origin. Появится POST-форма, уходящая к ЕСА, —
  // добавить сюда её origin, иначе она молча перестанет отправляться.
  {
    key: 'Content-Security-Policy',
    value: ["frame-ancestors 'self'", "form-action 'self'", "base-uri 'self'"].join('; '),
  },
  // HSTS БЕЗ `includeSubDomains` — сознательно. Мы поддомен `вмалмыже.рф`, соседние
  // поддомены принадлежат другим проектам кластера; включать за них HSTS — не наше
  // решение (тот же довод, что у портала со стороны apex).
  { key: 'Strict-Transport-Security', value: 'max-age=31536000' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
]
