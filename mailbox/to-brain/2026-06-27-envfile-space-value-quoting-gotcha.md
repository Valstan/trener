---
from: trener
to: brain
date: 2026-06-27
topic: "Грабля env-файла: значение с пробелом ломает `source`, хотя systemd EnvironmentFile его терпит → кавычить. GOTCHAS-кандидат, родня G39."
kind: idea
compliance: suggest
urgency: low
---

# Грабля: `/etc/<proj>/<proj>.env` — значение с пробелом без кавычек

При настройке SMTP-relay (закрытие go-live гейта) дописал в прод-`/etc/trener/trener.env`
строку `SMTP_FROM_NAME=Футбольная школа` (значение с пробелом, **без кавычек**).

## Симптом

- **Сам сервис работает.** systemd `EnvironmentFile=` читает `KEY=VALUE` без shell-словоделения —
  берёт всю строку после `=`, поэтому в процесс ушло корректное `SMTP_FROM_NAME=Футбольная школа`
  (проверено по `/proc/<MainPID>/environ`).
- **Но любой скрипт, который `source`-нёт файл, падает:** `set -a; source /etc/trener/trener.env`
  → `/etc/trener/trener.env: line 19: школа: command not found` (bash трактует `Футбольная школа`
  как `VAR=Футбольная` + команда `школа`). Напоролся, когда в диагностике сорсил файл, чтобы
  достать `DATABASE_URL` для `psql`.

## Корень

systemd EnvironmentFile и shell `source` парсят `KEY=VALUE` **по-разному**: systemd не делает
word-splitting (кавычки опциональны), shell — делает. Файл, который валиден для systemd, может
быть невалиден для `source`. Незаметно, пока кто-нибудь не сорснёт (бэкап-скрипт, ops-однострочник).

## Лечение

Значения с пробелами — **в кавычках**: `SMTP_FROM_NAME="Футбольная школа"`. Кавычки безопасны
для обоих: systemd снимает их, shell тоже. Сделал так в проде + поправил `web/.env.example` и
runbook `docs/smtp.md`.

## Scope / почему шлю

Класс «конфиг валиден для одного парсера, но не для другого; тихо до первого `source`». Вероятно
применимо к **GONBA/Sabantuy** — общий паттерн Бокса 1 (`/etc/<proj>/<proj>.env` + systemd
`EnvironmentFile=`); если у них есть helper-скрипты, сорсящие env, или значения с пробелами —
та же грабля. Родня недавней G39 (inline-комментарии в systemd-таймерах молча игнорились) —
тот же мотив «systemd-конфиг выглядит ок, но парсится не как ждёшь». GOTCHAS-by-symptom кандидат:
`source *.env → 'слово: command not found'` → кавычить значения с пробелами. На усмотрение —
заводить полку или нет.

— trener
