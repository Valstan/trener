# Offsite-бэкапы прод-БД — runbook

> Детские ПДн (152-ФЗ) → бэкап **шифруется на боксе публичным gpg-ключом** (приватный — вне
> бокса), хранится в **РФ-юрисдикции**, **offsite** (вне самого бокса). Дамп крошечный (~10 МБ).

## Архитектура

`trener-backup.timer` (03:30 MSK) → `trener-backup.service` (oneshot) →
[`/home/valstan/trener/bin/trener-backup.sh`](../deploy/backup/trener-backup.sh):

```
pg_dump -Fc | gpg --encrypt (публичный ключ)  →  WORKDIR/trener-<ts>.dump.gpg
                                               →  [rclone copy → RF S3]   (если задан remote)
```

Плейнтекст на диск не пишется (поток). **Choice-independent** — модель выбирается конфигом:

- **PUSH** (рекомендую): задан `BACKUP_RCLONE_REMOTE` → бокс пушит шифр-дамп в RF S3. Бокс всегда
  онлайн → надёжнее. Любой RF S3 через rclone (Yandex Object Storage / Selectel / VK / Timeweb).
- **PULL**: `BACKUP_RCLONE_REMOTE` пуст → дамп лежит в `WORKDIR`, его тянет домашняя машина по
  расписанию (`rsync`/`scp`). Без аккаунтов/денег, но машина должна быть включена.

Юниты приезжают деплоем (идемпотентно), но **таймер бэкапа НЕ включается автоматически** —
сначала одноразовая настройка ниже, потом владелец включает сам.

## Одноразовая настройка (действия владельца)

### 1. gpg-ключ (на СВОЕЙ машине, НЕ на боксе!)

```bash
gpg --quick-generate-key "trener backup <you@example.ru>" rsa4096 encr never
gpg --armor --export trener-backup-keyid > backup-pubkey.asc       # ПУБЛИЧНЫЙ — на бокс
# приватный ключ ОСТАЁТСЯ у тебя (экспортируй и положи в менеджер паролей / офлайн):
gpg --armor --export-secret-keys trener-backup-keyid > backup-secret.asc   # хранить ВНЕ бокса!
```

> ⚠️ Потеря приватного ключа = бэкапы нерасшифровываемы. Храни его офлайн, в нескольких местах.
> Не клади приватный ключ на бокс — иначе шифрование теряет смысл при компрометации бокса.

Публичный ключ → на бокс: `scp backup-pubkey.asc GONBA:/tmp/ && ssh GONBA "sudo mv /tmp/backup-pubkey.asc /etc/trener/backup-pubkey.asc"`.

### 2. Конфиг на боксе

```bash
ssh GONBA
sudo cp /home/valstan/trener/releases/current/... # шаблон: deploy/trener-backup.env.example в репо
sudo nano /etc/trener/trener-backup.env           # root:valstan, chmod 0640
```
Заполнить `BACKUP_DATABASE_URL` (app-роль годится; лучше выделенная read-only backup-роль),
`BACKUP_GPG_RECIPIENT_FILE=/etc/trener/backup-pubkey.asc`, `BACKUP_RETENTION_DAYS`.

### 3. Выбрать модель

- **PUSH:** на боксе `sudo apt-get install -y rclone`; `rclone config` → создать remote типа `s3`
  на RF-провайдера (endpoint/region/ключи); в env `BACKUP_RCLONE_REMOTE=<remote>:<bucket>/trener`.
  rclone.conf владельца — `~/.config/rclone/rclone.conf` (для запуска из systemd под `valstan` ок).
- **PULL:** `BACKUP_RCLONE_REMOTE` оставить пустым; на дом-машине завести таск, тянущий
  `rsync -az GONBA:/home/valstan/trener/backups/ <локально>/` (по расписанию).

### 4. Включить таймер

```bash
sudo systemctl enable --now trener-backup.timer
systemctl list-timers trener-backup.timer --no-pager
```

## Проверка / ручной прогон

```bash
ssh GONBA
sudo systemctl start trener-backup.service
journalctl -u trener-backup.service -n 20 --no-pager --output=cat   # "backup ok: trener-<ts>.dump.gpg ..."
ls -lh /home/valstan/trener/backups/                                # локальный шифр-дамп
# при PUSH: rclone ls <remote>:<bucket>/trener
```

## Восстановление (на доверенной машине с ПРИВАТНЫМ ключом)

```bash
# 1. достать дамп (из remote или из WORKDIR бокса)
rclone copy <remote>:<bucket>/trener/trener-<ts>.dump.gpg .      # PUSH
#   или: scp GONBA:/home/valstan/trener/backups/trener-<ts>.dump.gpg .   # PULL

# 2. расшифровать приватным ключом (он у тебя, не на боксе)
gpg --decrypt trener-<ts>.dump.gpg > trener.dump

# 3. восстановить в чистую БД
createdb trener_restore
pg_restore --no-owner --no-privileges -d trener_restore trener.dump
```

> pg_restore версии ≥ сервера-приёмника. Дамп снят pg_dump 16 (бокс PG16) — восстанавливать на PG16+.

## Грабли

- Юнит правишь (`.timer`/`.service`/скрипт) → следующий деплой переустановит идемпотентно. Таймер
  бэкапа после первого включения остаётся enabled (деплой его не трогает).
- `EnvironmentFile=/etc/trener/trener-backup.env` обязателен — нет файла → сервис падает (это ок до настройки).
- Ретенция (`BACKUP_RETENTION_DAYS`) косит и локально (`find -mtime`), и в remote (`rclone delete --min-age`).
- Выделенная backup-роль (вместо app): `CREATE ROLE trener_backup LOGIN PASSWORD '…'; GRANT CONNECT ON DATABASE trener TO trener_backup; GRANT USAGE ON SCHEMA public TO trener_backup; GRANT SELECT ON ALL TABLES IN SCHEMA public TO trener_backup; ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO trener_backup;` — pg_dump'у хватит SELECT.
