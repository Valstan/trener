# Машина: rmz4val

> Per-machine профиль ([pool #050](../../../brain_matrica/cross-project-ideas/ideas/050-per-machine-env-profiles.md)). **Без секретов** (#008).
>
> ✅ **Сверено на месте 2026-06-26** (первая сессия trener с этой машины). Dev-БД, pnpm, прогон каркаса — проверены живьём.

**Hostname:** `rmz4val`
**Роль:** домашний компьютер. WORKSPACE_ROOT = `D:\PROGRAMMING\` (НЕ `D:\GitHubReps\` как на PC40). Вторая машина — `PC40` (работа).
**Shell:** PowerShell + Git Bash.

## pnpm

- **pnpm НЕ в PATH** (в отличие от PC40) → проектные команды строго через **`corepack pnpm`** (corepack сам тянет пин `pnpm@10.15.0`). Подсказку «update 10.15.0 → 11.9.0» **игнорировать** — проект пинит 10.15.
- **Форма `corepack pnpm -C web <cmd>` НЕ работает** (2026-08-01, дважды): ломается
  мохибейком + `ERR_PNPM_RECURSIVE_EXEC_FIRST_FAIL Command "web" not found` —
  corepack-шим теряет `-C`. Только **`cd web && corepack pnpm <cmd>`**.
- **`corepack.cmd`-шим глотает коды выхода** (2026-08-01): упавший `typecheck`/`build`
  возвращает в Git Bash 0 → `set -e` НЕ прерывает цепочку, «зелёный» exit-код гейтов
  ничего не доказывает. Гейты проверять **по выводу** (grep `error|failed|passed`),
  а не по коду выхода / финальному echo.
- После pull PR, менявшего `web/pnpm-lock.yaml`: `cd web && corepack pnpm install` (иначе typecheck падает `Cannot find module`). Канарейка рассинхрона: нет `web/node_modules/web-push` → лок-файл новее node_modules (PR8 добавил `web-push`); 2026-08-01 тем же симптомом (`Cannot find module '@payloadcms/translations/languages/ru'`) вылезло после чужого бампа Payload.

## Dev-БД для trener (сверено)

- **Postgres 17.10**, бинарь psql: `C:\Program Files\PostgreSQL\17\bin\psql`.
- **Два сервиса**: использовать **`postgresql-x64-17`** (StartType **Manual** → стартовать вручную в начале сессии: `Start-Service postgresql-x64-17`, без elevation сработало). Старый сервис `PostgreSQL` — **Disabled**, не трогать.
- **Порт 5432** (НЕ 5433 как на PC40!). `postgresql.conf` → `port = 5432`. `web/.env` указывает на `127.0.0.1:5432`.
- БД **`trener_dev`** уже создана, суперюзер `postgres` / пароль `postgres`, схема M2 полностью материализована (`push:true`), таблицы пустые (сид-данных нет).
- Инстанс **общий** на несколько проектов: `gonba`, `sabantuy`, `matricarmz_dev`, `matricarmz_probe`, `vmalmyzhe_build`, `trener_dev` — не путать/не дропать чужие.

## web/.env (gitignored, #008)

- `DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/trener_dev`, `PAYLOAD_SECRET`, `NEXT_PUBLIC_SERVER_URL=http://localhost:3000`.
- Дописаны dev-ключи (2026-06-26): VAPID-пара (`NEXT_PUBLIC_VAPID_PUBLIC_KEY`/`VAPID_PRIVATE_KEY`/`VAPID_SUBJECT`) + `CRON_SECRET=<dev-значение>`. Шаблоны — `web/.env.example`. Реальная доставка push iOS/Android требует HTTPS (M3).

## Запуск / верификация (сверено 2026-06-26)

- Dev-сервер: `corepack pnpm -C web dev` (порт **3000**) — поднимается, главная рендерится, ошибок БД нет. Через preview-инструмент: конфиг `web-dev` в `.claude/launch.json`.
- `corepack pnpm -C web typecheck` — чисто. `corepack pnpm -C web test` — **67/67** зелёные.
- Скрипты Payload (если нужны): `./node_modules/.bin/payload run ./script.ts` (нужен top-level await).

## Offsite-бэкап: PULL-стяжка (LIVE 2026-06-28; восстановлена 2026-08-23)

- Эта машина — **pull-сторона** offsite-бэкапа прод-БД (см. [`docs/backups.md`](../backups.md)).
- Scheduled Task **`trener-backup-pull`** (ежедневно 04:30 MSK, StartWhenAvailable) запускает
  `C:\Users\Valstan\bin\trener-backup-pull.ps1` (канонично — `deploy/backup/trener-backup-pull.ps1`):
  `scp` шифр-дампов с бокса → `D:\YandexDisk\Backups\trener\` → клиент Диска уносит в облако.
- ⚠️ **23.08.2026 задача и `C:\Users\Valstan\bin\` обнаружены отсутствующими** (последний pull — 15.08,
  8 дней тишины, причина не установлена: журнал TaskScheduler/Operational выключен). Пересоздано
  той же сессией; прогон — `pull ok`. Молчаливая смерть = класс #104: проверять свежесть `_pull.log`
  на каждом `/start` с этой машины (одна строка `tail -1`).
- Задача сейчас с **`LogonType Interactive`** (S4U из неэлевированной агентской сессии → Access denied):
  работает при залогиненном пользователе (в т.ч. за блокировкой экрана). Апгрейд до S4U — из
  админ-консоли: `Set-ScheduledTask -TaskName trener-backup-pull -Principal (New-ScheduledTaskPrincipal -UserId $env:USERNAME -LogonType S4U)`.
- ssh-алиас бокса скрипт берёт из `TRENER_BOX_SSH_ALIAS` (D-038): задан user-level **и** продублирован
  в action самой задачи (S4U/Interactive не обязаны грузить профиль пользователя).
- **Клиент Яндекс.Диска должен быть запущен** (процесс `YandexDisk2`), иначе файл лежит локально и
  не уходит offsite до следующего логина/старта клиента.
- **Приватный gpg-ключ восстановления** живёт в keyring этой машины (`~/.gnupg`, fingerprint
  `CA8C5062…0FF7F5`) — для `gpg --decrypt`. Источник истины ключа — менеджер паролей
  владельца; **в `D:\YandexDisk` ключ не класть** (там лежат сами шифр-дампы).
- Ручной прогон/диагностика: `Start-ScheduledTask -TaskName trener-backup-pull`; лог —
  `D:\YandexDisk\Backups\trener\_pull.log`.

## Машинные грабли trener

- **`Start-Service postgresql-x64-17` иногда падает с `StartServiceFailed` с первого раза**
  (фантомный listen-сокет на :5432 от уже мёртвого PID — `Get-NetTCPConnection` показывает Listen,
  но `Get-Process`/коннект говорят, что процесса нет). Лечение — **просто повторить** `Start-Service`:
  со второго раза поднимается (сокет освобождается). Сверено 2026-06-27. **Агентская сессия НЕ admin**
  (проверено 23.08: `IsInRole(Administrator)` = False) — см. обход через `pg_ctl` ниже.
- **`jq` локально НЕТ** (в отличие от раннера GitHub). Любой тест шелл-логики с `jq` и
  `|| true` на этой машине выходит **пустым и зелёным**: `|| true` глотает
  `command not found`, и «гейт проверен» оказывается самообманом (поймано 24.08 на
  санитайзере `passport-probe.yml`). Лечение — шим, повторяющий `jq -re` (rc 0/1/2),
  или прогон на раннере; но не «тест прошёл, значит работает».
- **knip падает `RangeError: Array buffer allocation failed`** (oxc-parser не получает
  память). Сначала казалось — только при параллельном dev-сервере (2026-07-26), но
  2026-08-01 падал и без него, трижды подряд, `--max-old-space-size=4096` не помог
  (ArrayBuffer — вне V8-кучи). Локально гейт на этой машине ненадёжен — авторитет
  knip-гейта здесь CI (`ci.yml` шаг «Dead code»), по нему и судить.
- **`gh` с этой машины перемежающе таймаутится** (`api.github.com` / graphql, `wsarecv`),
  при том что push/pull по HTTPS проходят. Длинные цепочки (`pr checks` → `workflow run` →
  `run watch` → `pr merge`) гонять фоновой командой с `until`-ретраем, а не одним вызовом:
  один таймаут в середине иначе рвёт всю цепочку. Родня фильтрации из пункта ниже.
- **HTTPS к сервисам экосистемы с rmz4val иногда таймаутится** (`HTTP 000` / `UND_ERR_CONNECT_TIMEOUT`),
  хотя SSH к прод-хосту работает. Похоже на edge-фильтрацию IP у хостера (родня G8). Наблюдалось
  2026-06-29 при попытке POST в KARMAN-API напрямую с rmz4val. **Обход:** делать запрос по SSH с
  прод-хоста (адрес KARMAN для этого случая — по реестру Мозга) — секрет можно передать через stdin SSH,
  чтобы он не лёг на диск бокса. Раннее в ту же сессию :443 с rmz4val отвечал — т.е. фильтр перемежающийся.

## Postgres из агентской (неинтерактивной) сессии

`Start-Service postgresql-x64-17` / `net start` из неэлевированной агентской сессии
падают с Access denied (нет интерактивного UAC). Рабочий обход:
`pg_ctl start -D "C:\Program Files\PostgreSQL\17\data" -w` — стартует от текущего
пользователя без elevation (проверено сессиями D-029, 18.08.2026).
