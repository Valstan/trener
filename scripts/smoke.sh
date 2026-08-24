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
check_page "/"      "Футбольная школа"
check_page "/login" "Вход"
check_page "/demo"  "Демо-доступ"

if [ "$fails" -gt 0 ]; then
  echo "smoke: ПРОВАЛ — ${fails} проверк(и) не прошли"
  exit 1
fi
echo "smoke: всё сошлось"
