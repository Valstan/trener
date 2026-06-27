# Cron-задачи (systemd-таймеры) — runbook

> Периодические задачи trener на Боксе 1. Дёргают локальные `/cron/*`-эндпоинты с секретом.
> Юниты — в `deploy/systemd/`, ставятся и enable'ятся деплоем (`deploy-prod.yml`, идемпотентно),
> живут в `/etc/systemd/system/` (переживают смену релиза).

## RSVP-напоминания

- **Что:** `trener-rsvp-reminders.timer` → `…​.service` (oneshot) → `curl` на
  `http://127.0.0.1:3007/cron/rsvp-reminders` с заголовком `x-cron-secret: $CRON_SECRET`.
- **Когда:** ежедневно **09:00 MSK** (`OnCalendar=*-*-* 09:00:00 Europe/Moscow`, `Persistent=true`,
  джиттер `RandomizedDelaySec=3m`).
- **Логика эндпоинта** (`web/src/app/(frontend)/cron/rsvp-reminders/route.ts`): нереспондентам RSVP
  по тренировкам в окне **48ч**, best-effort пуш (in-app очередь первична). НЕ ack-эскалация.
- **Гард:** нет `CRON_SECRET` в env → эндпоинт `403` (выключен); неверный секрет → `401`.
  Секрет — в `/etc/trener/trener.env` (#008). Шлём заголовком (не `?secret=`) → не оседает в логах.

### Проверить / прогнать вручную (на боксе)

```bash
ssh GONBA
systemctl list-timers trener-rsvp-reminders.timer          # следующий/последний запуск
systemctl status trener-rsvp-reminders.timer               # активен ли таймер
sudo systemctl start trener-rsvp-reminders.service         # прогнать СЕЙЧАС (oneshot)
journalctl -u trener-rsvp-reminders.service -n 20 --no-pager   # результат: curl JSON + payload-лог
#   ok-ответ: {"ok":true,"sessions":N,"targets":M,"reminders":K}
#   до go-live (нет реальных родителей) ожидаемо sessions=0 / reminders=0 — это норма.
```

### Грабли

- Таймер ставится `enable --now` при первом деплое, где приехали юниты. Если правишь `.timer`/`.service`
  — следующий деплой переустановит идемпотентно (`cmp` → `cp` → `daemon-reload`). Менять расписание
  безопасно через PR (правка юнита) → merge → deploy.
- `oneshot`-сервис **не** enable'ится сам (его запускает только таймер) — это ожидаемо; `is-enabled`
  для `…​.service` покажет `static`/`disabled`, для `…​.timer` — `enabled`.
