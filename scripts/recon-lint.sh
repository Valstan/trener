#!/usr/bin/env bash
# recon-lint — гейт D-038: «публичный репозиторий — тоже recon-поверхность».
#
# Ищет в ОТСЛЕЖИВАЕМЫХ файлах инфра-детали прод-бокса, которым в репо не место
# (AGENTS.md, раздел «Публичный репозиторий — recon-поверхность»): технические
# хостнеймы VPS, «имя бокса + номер», публичные IPv4, домашние пути реальных
# пользователей, SSH-алиасы прод-бокса, unix-пользователь в юнитах/правах.
#
# Паттерны НАМЕРЕННО generic: сам линтер не должен содержать ни одного реального
# значения (иначе он и был бы утечкой). Поэтому хостер по имени, порт за прокси и
# состав соседей он НЕ ловит — это зона ревью и правила в AGENTS.md, не гейта.
#
# Исключения (по пути): mailbox/to-brain/ — отправленные письма, исторические записи
# (по мандату D-038 не переписываются); сам скрипт; бинарные/шрифты/lock-файл.
# Исключения (по содержимому): плейсхолдеры <deploy-user>/<box>/__DEPLOY_*__, loopback и
# приватные диапазоны IPv4, CI-локальный ssh-алиас TRENERBOX (определён в том же workflow
# из secrets), root:root, системные пользователи.
#
# Запуск: bash scripts/recon-lint.sh   (из любого места внутри репо; exit 1 при находках)

set -u
cd "$(git rev-parse --show-toplevel)"

# Кириллические классы в регэкспах ([Бб]окс…) требуют UTF-8-локали; на раннере по умолчанию
# она есть, но фиксируем явно, если доступна.
if locale -a 2>/dev/null | grep -qiE '^C\.utf-?8$'; then export LC_ALL=C.UTF-8; fi

FILES=$(git ls-files -z | tr '\0' '\n' \
  | grep -v -E '^(mailbox/to-brain/|scripts/recon-lint\.sh$)' \
  | grep -v -E '\.(png|jpg|jpeg|webp|ico|svg|woff2?|ttf|pdf)$' \
  | grep -v -E '(^|/)pnpm-lock\.yaml$')

g() { # grep по всем отслеживаемым файлам; $@ — аргументы grep
  printf '%s\n' "$FILES" | xargs -d '\n' grep -n "$@" 2>/dev/null
  return 0
}

hits=0
report() { # $1 — категория, $2 — найденные строки (пусто → ничего)
  local cat="$1" out="$2"
  [ -z "$out" ] && return 0
  echo "== $cat"
  echo "$out"
  hits=$((hits + $(printf '%s\n' "$out" | wc -l)))
}

# 1. Технический хостнейм VPS (hex-идентификатор + .vps./.srv./.host.) и любые *.vps.* хосты.
report 'tech-hostname (VPS)' "$(g -E '[0-9a-f]{8,}\.(vps|srv|host)\.|[a-z0-9-]+\.vps\.[a-z0-9.-]+')"

# 2. Имя бокса с номером: «Бокс 1», «Box-2», «box1» (grep -i не складывает кириллицу → явные классы).
report 'box-name' "$(g -E '[Бб]окс[а-я]*[ -]?[0-9]|\b[Bb]ox[ -]?[0-9]')"

# 3. Публичные IPv4 (не loopback / не приватные / не 0.0.0.0). Версии вида a.b.c.d — разбираются руками.
report 'public-ipv4' "$(g -E '\b([0-9]{1,3}\.){3}[0-9]{1,3}\b' \
  | grep -v -E '\b(127\.[0-9.]+|0\.0\.0\.0|10\.[0-9.]+|192\.168\.[0-9.]+|172\.(1[6-9]|2[0-9]|3[01])\.[0-9.]+)\b')"

# 4. Домашний каталог реального пользователя (/home/<имя>/); плейсхолдеры <deploy-user> / __DEPLOY_HOME__ не ловятся.
report 'home-path' "$(g -E '/home/[a-z][a-z0-9_-]+/')"

# 5. SSH/SCP/rsync к алиасу прод-бокса (алиасы в этом проекте — ЗАГЛАВНЫЕ); TRENERBOX — CI-локальный, из secrets.
report 'ssh-alias' "$(g -E '\b(ssh|scp|rsync)\b[^|;&]*\b[A-Z][A-Z0-9_]{2,}\b' \
  | grep -v -E 'TRENERBOX|<box>|\$\{?[A-Z]' \
  | grep -E '\b(ssh|scp|rsync)\b( +-[A-Za-z]+( +[^ ]+)?)* +[A-Z][A-Z0-9_]{2,}\b|[A-Z][A-Z0-9_]{2,}:')"

# 6. Unix-пользователь бокса в юнитах/правах (User=..., root:<user>); root:root и плейсхолдеры не ловятся.
report 'unix-user' "$(g -E '(^|[^A-Za-z:])(User=|User +|root:)[a-z][a-z0-9_-]+\b' \
  | grep -v -E 'root:root|__DEPLOY_USER__|<deploy-user>|User=(postgres|www-data|nobody)\b')"

if [ "$hits" -gt 0 ]; then
  echo
  echo "recon-lint: $hits строк(и) с инфра-деталями в отслеживаемых файлах (см. AGENTS.md → «Публичный репозиторий — recon-поверхность»)."
  exit 1
fi
echo "recon-lint: чисто"
