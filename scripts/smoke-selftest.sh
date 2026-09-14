#!/usr/bin/env bash
# Самопроверка scripts/smoke.sh на фикстурах.
#
# Гейт, проверенный только на живом проде, не проверен: живой прод зелёный и у
# декоративной проверки. Здесь каждому режиму фикстур сопоставлен ОЖИДАЕМЫЙ вердикт
# смоука, и расходится он в обе стороны:
#   • good обязан быть зелёным  — иначе смоук кричит на исправном (и его отключат);
#   • сломанные режимы обязаны быть красными — иначе смоук молчит на сломанном.
#
# Вторая половина важнее первой и именно её обычно не проверяют.
#
# Запуск: bash scripts/smoke-selftest.sh
set -u

PORT="${PORT:-8787}"
BASE="http://127.0.0.1:${PORT}"
HERE="$(cd "$(dirname "$0")" && pwd)"
fails=0

# режим:ожидаемый_код_выхода (0 = смоук зелёный, 1 = смоук красный)
CASES="
good:0
health-bad:1
page-500:1
no-marker:1
no-css-link:1
css-404:1
no-headers:1
csp-gutted:1
powered-by:1
no-llms:1
verify-missing:1
verify-301:1
no-canonical:1
canonical-shared:1
"

for case in $CASES; do
  mode="${case%%:*}"
  want="${case##*:}"

  MODE="$mode" node "${HERE}/smoke-fixtures.js" "$PORT" >/dev/null 2>&1 &
  pid=$!
  # Ждём, пока порт ответит, а не спим наугад.
  for _ in $(seq 1 50); do
    curl -s -o /dev/null --max-time 1 "${BASE}/health" && break
    sleep 0.1
  done

  out="$(bash "${HERE}/smoke.sh" "$BASE" 2>&1)"
  got=$?

  kill "$pid" 2>/dev/null
  wait "$pid" 2>/dev/null

  if [ "$got" = "$want" ]; then
    printf '  [ok]   MODE=%-16s смоук вернул %s\n' "$mode" "$got"
  else
    printf '  [FAIL] MODE=%-16s смоук вернул %s, ожидался %s\n' "$mode" "$got" "$want"
    printf '%s\n' "$out" | sed 's/^/         | /'
    fails=$((fails + 1))
  fi
done

if [ "$fails" -gt 0 ]; then
  echo "selftest: ПРОВАЛ — ${fails} режим(ов) разошлись с ожиданием"
  exit 1
fi
echo "selftest: смоук зелен на исправном и краснеет на каждом из $(( $(echo "$CASES" | grep -c :) - 1 )) сломанных режимов"
