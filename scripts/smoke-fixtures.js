#!/usr/bin/env node
// Фикстурный стенд для scripts/smoke.sh.
//
// ЗАЧЕМ. Смоук — гейт, а гейт, проверенный только на живом проде, ничего не доказывает:
// живой прод зелёный и у декоративной проверки, которая всегда возвращает «ок». Чтобы
// знать, что смоук ловит поломку, нужен сервер, который умеет быть сломанным нужным
// образом. Правило «правишь смоук — гоняй фикстурами» жило в SESSION_HANDOFF с 24.08,
// но самих фикстур в репозитории не было: их собрали разово в сессии #163 и не
// закоммитили. Следующая сессия прочитала бы правило и не смогла его выполнить.
//
// ЗАПУСК: node scripts/smoke-fixtures.js [порт]   (режим — в переменной MODE)
// Прогон всех режимов разом — scripts/smoke-selftest.sh.

const http = require('http')

const MODE = process.env.MODE || 'good'
const PORT = Number(process.argv[2] || 8787)

const CSS = 'body{color:#111}'
const CSS_HREF = '/_next/static/css/app.css'

const SECURITY_HEADERS = {
  'Content-Security-Policy': "frame-ancestors 'self'; form-action 'self'; base-uri 'self'",
  'Strict-Transport-Security': 'max-age=31536000',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'X-Frame-Options': 'SAMEORIGIN',
}

// Страницы в том виде, в каком их ждёт smoke.sh: видимый маркер + подключённый стиль.
const PAGES = {
  '/': 'Интер — футбольная школа в Малмыже',
  '/login': 'Вход',
  '/demo': 'Демо-доступ',
  '/privacy': 'Политика',
}

// Канонический адрес в том виде, в каком его отдаёт НАСТОЯЩИЙ Next: у главной — без
// завершающего слэша. Первая версия фикстур отдавала `/` со слэшем, то есть моделировала
// допущение автора, а не поведение фреймворка, — и благословила проверку, которая
// роняла деплой на исправном проде. Фикстура, которая врёт удобнее правды, хуже её
// отсутствия: она выдаёт доверие, ничем не обеспеченное.
const canonicalHref = (path) =>
  path === '/' ? `http://127.0.0.1:${PORT}` : `http://127.0.0.1:${PORT}${path}`

const page = (path, marker, { cssLink = true, canonical = true } = {}) =>
  [
    '<!doctype html><html lang="ru"><head><meta charset="utf-8">',
    cssLink ? `<link rel="stylesheet" href="${CSS_HREF}">` : '',
    canonical ? `<link rel="canonical" href="${canonicalHref(path)}">` : '',
    `</head><body><h1>${marker}</h1></body></html>`,
  ].join('')

const send = (res, code, body, type = 'text/html; charset=utf-8', headers = {}) => {
  res.writeHead(code, { 'Content-Type': type, ...headers })
  res.end(body)
}

const server = http.createServer((req, res) => {
  const path = req.url.split('?')[0]

  // Заголовки безопасности навешиваем на всё, кроме режима no-headers.
  const sec = MODE === 'no-headers' ? {} : { ...SECURITY_HEADERS }
  if (MODE === 'csp-gutted') sec['Content-Security-Policy'] = "frame-ancestors 'self'"
  if (MODE === 'powered-by') sec['X-Powered-By'] = 'Next.js, Payload'

  if (path === '/health') {
    const body = MODE === 'health-bad' ? '{"ok":false}' : '{"ok":true}'
    return send(res, 200, body, 'application/json', sec)
  }

  if (path === CSS_HREF) {
    // css-404: разметка цела и ссылается на стиль, но бандла нет — глазами страница
    // сломана, а по коду ответа самой страницы всё «в порядке».
    if (MODE === 'css-404') return send(res, 404, 'not found', 'text/plain', sec)
    return send(res, 200, CSS, 'text/css', sec)
  }

  if (path === '/llms.txt') {
    if (MODE === 'no-llms') return send(res, 404, 'not found', 'text/plain', sec)
    return send(res, 200, 'Интер — футбольная школа в Малмыже\n', 'text/plain; charset=utf-8', sec)
  }

  if (path === '/yandex_4f941049c2a8cc91.html') {
    // 301 — именно тот случай, за которым Яндекс не идёт (G337): файл «есть»,
    // а права не подтверждаются.
    if (MODE === 'verify-301') {
      return send(res, 301, '', 'text/html', { ...sec, Location: 'https://example.com/' })
    }
    if (MODE === 'verify-missing') return send(res, 404, 'not found', 'text/plain', sec)
    return send(res, 200, '<html><body>Verification: 4f941049c2a8cc91</body></html>', 'text/html', sec)
  }

  if (path in PAGES) {
    if (MODE === 'page-500' && path === '/') return send(res, 500, 'boom', 'text/plain', sec)
    const opts = {
      cssLink: !(MODE === 'no-css-link' && path === '/'),
      // canonical-shared: каждая страница объявляет каноническим адрес главной —
      // ровно то, что делает абсолютный canonical в корневом layout (G312).
      canonical: MODE !== 'no-canonical',
    }
    const marker = MODE === 'no-marker' && path === '/' ? 'Ошибка' : PAGES[path]
    let html = page(path, marker, opts)
    if (MODE === 'canonical-shared') {
      html = html.replace(`href="${canonicalHref(path)}"`, `href="http://127.0.0.1:${PORT}"`)
    }
    // Корень СО слэшем — форма записи, а не поломка: смоук обязан принять и её,
    // иначе он краснеет на исправном сайте (ровно это и случилось на проде 14.09).
    if (MODE === 'canonical-root-slash' && path === '/') {
      html = html.replace(`href="${canonicalHref(path)}"`, `href="http://127.0.0.1:${PORT}/"`)
    }
    return send(res, 200, html, 'text/html; charset=utf-8', sec)
  }

  send(res, 404, 'not found', 'text/plain', sec)
})

server.listen(PORT, '127.0.0.1', () => {
  process.stdout.write(`fixtures MODE=${MODE} http://127.0.0.1:${PORT}\n`)
})
