# Offsite-бэкапы прод-БД — runbook

> Детские ПДн (152-ФЗ) → бэкап **шифруется на боксе публичным gpg-ключом** (приватный — вне
> бокса), хранится в **РФ-юрисдикции**, **offsite** (вне самого бокса). Дамп крошечный (~10 МБ).

## ✅ Настроено 2026-06-28 (LIVE) — PULL → Яндекс.Диск

Боевая конфигурация (выбрана **PULL-модель** через уже работающий клиент Яндекс.Диска на `rmz4val`
— тот же механизм, что бэкапит MatricaRMZ; ноль новых аккаунтов/ключей S3, изоляция от Сабантуя).

- **gpg-ключ** (выделенный, encrypt-only, rsa4096, без срока): fingerprint
  `CA8C50622FAC950CE1FD67B20E93B5A95E0FF7F5`, uid `trener-backup (offsite DB backup) <zubazeirot@proton.me>`.
  Публичный — на боксе `/etc/trener/backup-pubkey.asc`. **Приватный ключ хранится в менеджере
  KARMAN** (`BACKUP_GPG_PRIVATE_KEY` + `BACKUP_GPG_PUBLIC_KEY` + `BACKUP_GPG_FINGERPRINT`; целостность
  сверена sha256 при заливке 2026-06-29) **и** рабочей копией в gpg-keyring `rmz4val`. **НЕ в
  Яндекс.Диске** (там сами шифр-дампы). Восстановить ключ:
  `GET /api/secrets?key=BACKUP_GPG_PRIVATE_KEY` → импорт `gpg --import` (см.
  [`secrets-manager.md`](secrets-manager.md)).
  - ⚠️ **Осознанный компромисс владельца (2026-06-29):** KARMAN живёт на том же боксе, что и бэкапы,
    и умеет расшифровать свои секреты → при компрометации бокса приватный ключ и локальные шифр-дампы
    оказываются вместе, т.е. бэкапы становятся расшифровываемыми. Принято сознательно: риск «владелец
    потеряет ключ → дампы мёртвы» для этого проекта реальнее, чем целевой взлом VPS ради дешифровки.
    Усиление (если посоображения изменятся): запаролить ключ сильной passphrase и хранить в KARMAN
    уже защищённым (passphrase — вне бокса).
- **Бокс:** `trener-backup.timer` (enabled, 03:30 MSK) → `trener-backup.service` →
  `bin/trener-backup.sh`. Конфиг `/etc/trener/trener-backup.env`: `BACKUP_DATABASE_URL`
  (= app-роль `trener_app`), `BACKUP_RETENTION_DAYS=30`, `BACKUP_RCLONE_REMOTE=` **пуст** (PULL).
  Шифр-дампы копятся в `/home/valstan/trener/backups/`.
- **rmz4val (стяжка):** Scheduled Task `trener-backup-pull` (ежедневно 04:30 MSK, S4U,
  StartWhenAvailable) → `deploy/backup/trener-backup-pull.ps1` (рабочая копия в
  `C:\Users\Valstan\bin\`) → `scp` шифр-дампов в **`D:\YandexDisk\Backups\trener\`** → клиент Диска
  уносит в облако. Лог — `_pull.log` рядом.
- **Проверено end-to-end:** дамп `pg_dump 16.14 → gpg(public)` → на rmz4val `gpg(private) →
  pg_restore --list` = валидный CUSTOM-архив, 293 TOC / 44 таблицы. Восстановимость подтверждена.
- **Остаточная ручная сверка:** один раз глазами убедиться, что файл появился на disk.yandex.ru
  (клиент Диска должен быть запущен/онлайн — программно отсюда не верифицируется).

> Менять модель на PUSH→S3 (если дом-машина окажется ненадёжной): заполнить `BACKUP_RCLONE_REMOTE`
> в `/etc/trener/trener-backup.env` + `apt install rclone` + `rclone config` на боксе; pull-задачу
> на rmz4val тогда отключить. Бокс держит локальную копию 30 дней при любой модели.

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
