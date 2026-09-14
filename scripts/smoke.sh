#!/usr/bin/env bash
# smoke.sh — приёмка выката по СОДЕРЖИМОМУ, а не по коду ответа (#011, совет Мозга #113).
#
# Зачем: `/health` отвечает 200, пока жив рантайм, и молчит про то, что видит человек.
# 09.08 деплой отчитался зелёным (включая smoke `/health`), пока счётчик на лендинге был
# мёртв; у ДК тот же smoke честно врал, пока не проверял содержимое. Поэтому здесь:
# страница отдала свой видимый маркер И её CSS-бандл реально загрузился.
#
# `/demo` в наборе не случайно: с D-029 это самая посещаемая страница у незнакомых людей
# (совет Мозга 19.08), и ломается она на глазах покупателя.
#
# Запуск: scripts/smoke.sh <base-url>
# Код возврата: 0 — всё сошлось; 1 — есть провал; 2 — неверный вызов.
# Все проверки прогоняются до конца: в логе нужен полный список, а не первая ошибка.

set -uo pipefail

# Маркеры кириллические → нужна UTF-8-локаль (та же грабля, что в recon-lint).
if locale -a 2>/dev/null | grep -qiE '^C\.utf-?8$'; then export LC_ALL=C.UTF-8; fi

BASE="${1:-}"
if [ -z "$BASE" ]; then
  echo "usage: scripts/smoke.sh <base-url>" >&2
  exit 2
fi
BASE="${BASE%/}"

CURL_OPTS=(-sS --connect-timeout 10 --max-time 25)
fails=0

BODY_FILE="$(mktemp)"
trap 'rm -f "$BODY_FILE"' EXIT
RC=0
CODE="000"

ok()   { printf '  [ok]   %s\n' "$1"; }
fail() { printf '  [FAIL] %s\n' "$1"; echo "::error::smoke: $1"; fails=$((fails + 1)); }

# fetch <path> — тело кладёт в $BODY_FILE, HTTP-код в CODE, транспортный rc в RC.
# ВАЖНО: вызывать БЕЗ подстановки `$(...)`. Подстановка порождает подоболочку, и
# присваивания глобальных RC/CODE до вызывающего кода не доезжают — поймано мутационным
# прогоном: смоук краснел на ВСЕХ фикстурах, включая заведомо исправную.
# Транспортную ошибку отличаем от HTTP-ошибки: RC≠0 — это сеть/DNS/таймаут, зона
# инфраструктуры, а не содержимого.
fetch() {
  local path="$1" rc=0
  CODE="$(curl "${CURL_OPTS[@]}" -o "$BODY_FILE" -w '%{http_code}' "${BASE}${path}" 2>/dev/null)" || rc=$?
  RC="$rc"
  if [ "$rc" != 0 ]; then
    CODE="000"
    : > "$BODY_FILE"
  fi
}

# check_page <path> <маркер> — 200 + видимый маркер в HTML + подключённый стиль,
# который реально отдаётся. Маркер ищем literal (grep -F): это текст страницы, не регэксп.
check_page() {
  local path="$1" marker="$2" href css_code css_url
  fetch "$path"

  if [ "$RC" != 0 ]; then
    fail "${path} — не отвечает (curl rc=${RC}: 6=DNS, 7=connect, 28=таймаут)"
    return
  fi
  if [ "$CODE" != "200" ]; then
    fail "${path} — HTTP ${CODE}, ожидался 200"
    return
  fi
  ok "${path} — HTTP 200"

  if grep -qF -- "$marker" "$BODY_FILE"; then
    ok "${path} — маркер «${marker}» на месте"
  else
    fail "${path} — HTML отдан, но маркера «${marker}» в нём НЕТ (пустая/сломанная страница)"
  fi

  # CSS: мало сослаться — бандл должен отдаваться. Ровно этот класс ловит «ресурс отдался
  # с 200 ≠ он работает»: разметка целая, стилей нет, глазами — сломанная страница.
  href="$(grep -oE '<link[^>]+rel="stylesheet"[^>]*>' "$BODY_FILE" | grep -oE 'href="[^"]+"' | head -1 | cut -d'"' -f2)"
  if [ -z "$href" ]; then
    fail "${path} — нет ни одной ссылки на стиль (CSS-бандл не подключён)"
    return
  fi
  case "$href" in
    http*) css_url="$href" ;;
    /*)    css_url="${BASE}${href}" ;;
    *)     css_url="${BASE}/${href}" ;;
  esac
  css_code="$(curl "${CURL_OPTS[@]}" -o /dev/null -w '%{http_code}' "$css_url" 2>/dev/null || echo 000)"
  if [ "$css_code" = "200" ]; then
    ok "${path} — CSS-бандл отдаётся (200)"
  else
    fail "${path} — CSS-бандл не отдаётся (HTTP ${css_code}) при живой разметке"
  fi
}

# check_security_headers — заголовки безопасности на месте, и стек мы не называем сами.
# Список-источник — web/src/lib/securityHeaders.ts (там же доводы по каждому и юнит-тест);
# здесь проверяется не список, а ФАКТ ВЫДАЧИ по публичному адресу: тест не заметит, если
# заголовки потеряются между конфигом и ответом (снятый `headers()`, прокси, режущий их,
# правка next.config.ts мимо модуля).
#
# Имена регистронезависимо: HTTP/2 отдаёт их в нижнем регистре, HTTP/1.1 — как написано.
check_security_headers() {
  local head_file rc=0 missing=0 name
  head_file="$(mktemp)"
  curl "${CURL_OPTS[@]}" -o /dev/null -D "$head_file" "${BASE}/" 2>/dev/null || rc=$?
  if [ "$rc" != 0 ]; then
    fail "заголовки — не удалось снять (curl rc=${rc})"
    rm -f "$head_file"
    return
  fi

  for name in Content-Security-Policy Strict-Transport-Security X-Content-Type-Options \
              Referrer-Policy X-Frame-Options; do
    if grep -qiE "^${name}:" "$head_file"; then
      ok "заголовок ${name} на месте"
    else
      fail "заголовок ${name} НЕ отдаётся"
      missing=$((missing + 1))
    fi
  done

  # Три директивы CSP по отдельности: заголовок может присутствовать и при этом быть
  # выпотрошен до одной директивы — «CSP есть» тогда успокаивает зря.
  local csp
  csp="$(grep -iE '^Content-Security-Policy:' "$head_file" | head -1)"
  for name in "frame-ancestors 'self'" "form-action 'self'" "base-uri 'self'"; do
    if printf '%s' "$csp" | grep -qF -- "$name"; then
      ok "CSP: ${name}"
    else
      fail "CSP: директивы «${name}» нет"
    fi
  done

  # poweredByHeader: false — не подсказываем сканеру, какие CVE пробовать.
  if grep -qiE '^X-Powered-By:' "$head_file"; then
    fail "X-Powered-By отдаётся — стек называем сами (ожидался poweredByHeader: false)"
  else
    ok "X-Powered-By не отдаётся"
  fi

  rm -f "$head_file"
}

echo "smoke: ${BASE}"

# 1. Рантайм поднялся — самая дешёвая проверка, поэтому первой.
fetch /health
if [ "$RC" != 0 ]; then
  fail "/health — не отвечает (curl rc=${RC})"
elif [ "$CODE" != "200" ]; then
  fail "/health — HTTP ${CODE}, ожидался 200"
elif grep -qF '"ok":true' "$BODY_FILE"; then
  ok "/health — 200 и ok:true"
else
  fail "/health — 200, но тело не содержит ok:true"
fi

# 2. Страницы, которые видит человек. Маркер — видимый текст, переживающий смену вёрстки.
check_page "/"      "Интер — футбольная школа в Малмыже"
check_page "/login" "Вход"
check_page "/demo"  "Демо-доступ"

# 3. Заголовки безопасности. До 14.09.2026 их не было НИ ОДНОГО, и заметили это не мы,
# а Мозг снаружи. Ровно тот класс, ради которого написан этот скрипт: пропажа заголовка
# не роняет сборку, не краснит тест и не видна на экране — её видно только вот так.
check_security_headers

# 4. Публичные файлы из web/public/. Их не видно ни на одном экране и не проверяет ни
# один тест: пропадут при правке сборки или .gitignore — сайт продолжит выглядеть
# исправным. Цена пропажи разная, но обе тихие: Вебмастер снимет подтверждение прав,
# нейросети потеряют карту сайта.
check_exact_file() {
  local path="$1" marker="$2"
  fetch "$path"
  if [ "$RC" != 0 ]; then
    fail "${path} — не отвечает (curl rc=${RC})"
  elif [ "$CODE" != "200" ]; then
    # Именно 200, не 301: за редиректом на другое имя Яндекс не идёт (G337).
    fail "${path} — HTTP ${CODE}, ожидался 200"
  elif grep -qF -- "$marker" "$BODY_FILE"; then
    ok "${path} — 200 и тело на месте"
  else
    fail "${path} — 200, но тела «${marker}» нет"
  fi
}

check_exact_file "/yandex_4f941049c2a8cc91.html" "Verification: 4f941049c2a8cc91"
check_exact_file "/llms.txt"                     "Интер — футбольная школа в Малмыже"

# 5. Канонический адрес у каждой страницы СВОЙ (G312). Абсолютная строка в корневом
# layout вместо './' объявила бы весь сайт копией главной — в браузере это не видно
# никак, а из индекса выпадает всё, кроме одной страницы. Юнит рядом стережёт исходник,
# здесь — факт выдачи.
check_canonical() {
  local path="$1" expected="$2" got
  fetch "$path"
  if [ "$CODE" != "200" ]; then
    fail "canonical ${path} — страница отдала HTTP ${CODE}"
    return
  fi
  # Адрес вырезаем cut'ом по кавычкам, а не sed с обратной ссылкой: в совпадении
  # `<link rel="canonical" href="URL"` четвёртое поле — сам URL. Первая версия была
  # на sed с обратной ссылкой, и ссылка при генерации файла превратилась в
  # УПРАВЛЯЮЩИЙ БАЙТ 0x01: замена стала пустой, и проверка краснела в том числе на
  # исправном сайте. Поймал режим good фикстур, а не прод.
  got="$(grep -oE '<link rel="canonical" href="[^"]+"' "$BODY_FILE" | head -1 | cut -d'"' -f4)"
  if [ -z "$got" ]; then
    fail "canonical ${path} — тега нет вовсе"
  elif [ "$got" = "$expected" ]; then
    ok "canonical ${path} — ${got}"
  else
    fail "canonical ${path} — ${got}, ожидался ${expected}"
  fi
}

check_canonical "/"        "${BASE}/"
check_canonical "/privacy" "${BASE}/privacy"

if [ "$fails" -gt 0 ]; then
  echo "smoke: ПРОВАЛ — ${fails} проверк(и) не прошли"
  exit 1
fi
echo "smoke: всё сошлось"
