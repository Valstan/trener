#!/bin/sh
# Offsite-бэкап БД trener: pg_dump -Fc → gpg-шифр (публичным ключом) → [rclone в RF-хранилище].
#
# 152-ФЗ: дамп содержит детские ПДн → ВСЕГДА шифруется на боксе ПУБЛИЧНЫМ gpg-ключом.
# Приватный ключ ДОЛЖЕН жить ВНЕ бокса (у владельца) → компрометация бокса не вскрывает бэкапы.
# Плейнтекст на диск не пишется (pg_dump | gpg потоком). Хранилище — РФ-юрисдикция (см. docs/backups.md).
#
# Choice-independent: ставит шифрованный дамп в локальный WORKDIR (ретенция). Если задан
# BACKUP_RCLONE_REMOTE — ещё и пушит offsite (push-модель, любой RF S3 через rclone). Если не задан —
# дамп просто лежит в WORKDIR, откуда его тянет домашняя машина (pull-модель). Выбор — конфигом, не кодом.
#
# Конфиг — из /etc/trener/trener-backup.env (вне репо, #008). Шаблон: deploy/trener-backup.env.example.
set -eu

: "${BACKUP_DATABASE_URL:?нет в trener-backup.env (роль с правом дампа)}"
: "${BACKUP_GPG_RECIPIENT_FILE:?нет (путь к public-ключу, напр. /etc/trener/backup-pubkey.asc)}"
WORK="${BACKUP_WORKDIR:-/home/valstan/trener/backups}"
RETAIN_DAYS="${BACKUP_RETENTION_DAYS:-30}"

[ -f "$BACKUP_GPG_RECIPIENT_FILE" ] || { echo "нет public-ключа: $BACKUP_GPG_RECIPIENT_FILE" >&2; exit 1; }
mkdir -p "$WORK"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
NAME="trener-${STAMP}.dump.gpg"
OUT="$WORK/$NAME"

# dump → encrypt потоком (плейнтекст не материализуется). --trust-model always: ключ доверяем по факту
# его наличия в recipient-файле (не выстраиваем web-of-trust на боксе).
pg_dump --format=custom --no-owner --no-privileges "$BACKUP_DATABASE_URL" \
  | gpg --batch --yes --trust-model always --encrypt \
        --recipient-file "$BACKUP_GPG_RECIPIENT_FILE" \
        --output "$OUT"

SIZE="$(du -h "$OUT" | cut -f1)"

# offsite push (push-модель) — только если задан remote
if [ -n "${BACKUP_RCLONE_REMOTE:-}" ]; then
  rclone copy "$OUT" "$BACKUP_RCLONE_REMOTE" --no-traverse
  # ретенция в remote
  rclone delete "$BACKUP_RCLONE_REMOTE" --min-age "${RETAIN_DAYS}d" --include 'trener-*.dump.gpg' 2>/dev/null || true
  echo "backup ok: $NAME ($SIZE) → local + $BACKUP_RCLONE_REMOTE"
else
  echo "backup ok: $NAME ($SIZE) → local only (pull-модель: тянуть из $WORK)"
fi

# локальная ретенция (и для push — короткое окно/буфер; и для pull — окно доступности)
find "$WORK" -name 'trener-*.dump.gpg' -mtime "+${RETAIN_DAYS}" -delete
