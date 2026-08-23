# Менеджер секретов KARMAN — как это работает в trener

> ✅ **Подключено 2026-06-29.** trener хранит свои рантайм-секреты зашифрованными в
> менеджере [KARMAN](../../karman) и восстанавливает их при старте, если локальная копия
> потеряна. Это **резервный** канал на случай потери `/etc/trener/trener.env`, а не основной
> источник: в норме секреты по-прежнему приходят из systemd `EnvironmentFile`.

## Идея

- Секреты лежат **зашифрованными** в KARMAN (AES-256-GCM, мастер-ключ только на сервере KARMAN).
- trener ходит к API по **Bearer-токену** (`SECRETS_TOKEN`), скоуп токена — только проект trener.
- В норме (`/etc/trener/trener.env` на месте) приложение **не** обращается к KARMAN — ноль сетевых
  вызовов. Восстановление включается только как авария: REQUIRED-ключей нет в `process.env`.

## Где живёт токен (и почему отдельно)

`SECRETS_TOKEN` — это **bootstrap-секрет**: им восстанавливают всё остальное. Поэтому он живёт
**ОТДЕЛЬНО** от восстанавливаемого env, иначе терялся бы вместе с ним.

| Среда | Где токен | Гит |
|---|---|---|
| Прод (бокс) | `/etc/trener/secrets-token.env` (`root:<deploy-user> 0640`), подключается отдельным `EnvironmentFile=-` в `trener.service` | вне репо (#008) |
| Локально (dev) | `web/.env` (gitignored) | вне репо |

`/etc/trener/trener.env` (DATABASE_URL, PAYLOAD_SECRET, VAPID_PRIVATE_KEY, CRON_SECRET, SMTP_*) —
это **то, что восстанавливаем**; в KARMAN сохранены все его ключи (14 шт., см. ниже). Токен в KARMAN
НЕ кладём.

## Как восстановление работает в рантайме

`web/src/instrumentation.ts` (Next.js instrumentation hook, `register()` — один раз при старте
сервера, до приёма запросов и до импорта `payload.config`) вызывает
`web/src/lib/secretsBootstrap.ts` → `bootstrapSecretsFromManager()`:

1. Если `DATABASE_URL` и `PAYLOAD_SECRET` уже есть в `process.env` → выходит сразу (норма, без сети).
2. Иначе, если есть `SECRETS_TOKEN` → `GET /api/secrets` по токену → наполняет `process.env`
   недостающими ключами (**не перетирая** то, что уже дал systemd).
3. Токена нет / KARMAN недоступен → логирует и НЕ валит старт (приложение упадёт штатно уже на
   коннекте к БД — то же поведение, что без восстановления).

Восстановление — **в память процесса** (на диск не пишет); при следующем рестарте, если env всё
ещё потерян, тянет снова (идемпотентно). Покрыто юнит-тестами `secretsBootstrap.test.ts`.

## Эндпоинт и API

Эндпоинт: `https://<karman-host>/api/secrets` (дефолта в коде нет; адрес — в
`SECRETS_MANAGER_URL` рядом с токеном, на проде в `/etc/trener/secrets-token.env`). Полный контракт — [`../../karman/docs/secrets-client-guide.md`](../../karman/docs/secrets-client-guide.md).

```bash
# Прочитать все (имена+значения видны только по валидному токену):
curl -H "Authorization: Bearer $SECRETS_TOKEN" https://<karman-host>/api/secrets
# Один ключ:
curl -H "Authorization: Bearer $SECRETS_TOKEN" "https://<karman-host>/api/secrets?key=PAYLOAD_SECRET"
# Сохранить/обновить (upsert):
curl -X POST https://<karman-host>/api/secrets \
  -H "Authorization: Bearer $SECRETS_TOKEN" -H "Content-Type: application/json" \
  -d '{"secrets":{"KEY":"value"}}'
```

Коды: `200` ок · `400` плохое тело · `401` нет/битый токен · `403` токен read-only · `404` нет
ключа (GET ?key=) · `429` лимит (~60/мин).

## Что уже сохранено

Прод-секреты залиты в KARMAN одним POST (2026-06-29), 14 ключей: `CRON_SECRET`, `DATABASE_URL`,
`NEXT_PUBLIC_SERVER_URL`, `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `PAYLOAD_SECRET`, `SMTP_FROM_ADDRESS`,
`SMTP_FROM_NAME`, `SMTP_HOST`, `SMTP_PASS`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`,
`VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`.

Плюс приватный/публичный ключ offsite-бэкапов (по решению владельца — резерв на случай потери,
[`backups.md`](backups.md) описывает компромисс): `BACKUP_GPG_PRIVATE_KEY`, `BACKUP_GPG_PUBLIC_KEY`,
`BACKUP_GPG_FINGERPRINT`. Итого **17 ключей**. Эти `BACKUP_GPG_*` — НЕ рантайм-секреты приложения
(restore-recovery их в `process.env` не тянет, REQUIRED-список их не содержит), хранятся тут только
как защищённое резервное копилище.

### Пересохранить после смены секрета

При смене любого секрета на проде (например, ротация SMTP-пароля) — пересохранить в KARMAN, чтобы
резерв не устарел. С бокса (значения не печатаются, только имена):

```bash
set -a; . /etc/trener/secrets-token.env; set +a
node -e '
  const fs=require("fs"), s={};
  for(const l of fs.readFileSync("/etc/trener/trener.env","utf8").split(/\r?\n/)){
    const m=l.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/); if(!m) continue;
    let [,k,v]=m; if(k==="SECRETS_TOKEN") continue; v=v.trim();
    if(/^".*"$|^'"'"'.*'"'"'$/.test(v)) v=v.slice(1,-1); s[k]=v;
  }
  fetch("https://<karman-host>/api/secrets",{method:"POST",
    headers:{Authorization:"Bearer "+process.env.SECRETS_TOKEN,"Content-Type":"application/json"},
    body:JSON.stringify({secrets:s})}).then(async r=>console.log(r.status, await r.text()));
'
```

### ⚠️ `NEXT_PUBLIC_*` ротируются только пересборкой

Два ключа из списка выше — `NEXT_PUBLIC_SERVER_URL` и `NEXT_PUBLIC_VAPID_PUBLIC_KEY` —
**запечены в бандл на CI-сборке** и правкой `/etc/trener/trener.env` не меняются.
Проверено эмпирически 2026-08-01 (Next 15.4.11): `DefinePlugin` подставляет значения
`NEXT_PUBLIC_*`, существующие на момент `next build`, **и в серверные чанки тоже** —
выражение `process.env.NEXT_PUBLIC_X` исчезает из кода, остаётся строковая константа.
`export const dynamic = 'force-dynamic'` от этого не спасает: он про момент рендера,
а не про подстановку компилятором. Источник значений для сборки один —
блок `env:` job'а в [`deploy-prod.yml`](../.github/workflows/deploy-prod.yml).

Практический риск — **ротация VAPID-пары**. Если положить новый публичный ключ в
`trener.env` и в KARMAN, но не пересобрать: сервер подписывает новым приватным,
клиент подписан старым публичным (запечённым) — доставка пушей отваливается молча,
без ошибки в логах. Порядок ротации: сначала значение в `deploy-prod.yml`, потом
пересборка/деплой, и только затем — пересохранение в KARMAN.

Обратная сторона того же механизма: `NEXT_PUBLIC_*`, которой **нет** в CI-окружении,
компилятор не трогает — она читается из окружения процесса в рантайме, и её можно
задать одним `trener.env` без пересборки (так до 01.08 работал ныне удалённый
`NEXT_PUBLIC_SALES_CONTACT`). То есть одно и то же имя ведёт себя по-разному в
зависимости от того, было ли оно задано на сборке; заданное **в обоих местах**
разрешается молча в пользу запечённого.

## Ручное восстановление (если env потерян, без рестарта приложения)

```bash
set -a; . /etc/trener/secrets-token.env; set +a
curl -s -H "Authorization: Bearer $SECRETS_TOKEN" https://<karman-host>/api/secrets \
  | node -e 'const j=JSON.parse(require("fs").readFileSync(0,"utf8"));
      process.stdout.write(Object.entries(j.secrets).map(([k,v])=>
        /\s/.test(v)?`${k}="${v}"`:`${k}=${v}`).join("\n")+"\n");' \
  | sudo tee /etc/trener/trener.env >/dev/null
sudo chown root:<deploy-user> /etc/trener/trener.env && sudo chmod 0640 /etc/trener/trener.env
sudo systemctl restart trener.service
```

## Ротация токена

Токены KARMAN бессрочные. Если `SECRETS_TOKEN` утёк/потерян — владелец отзывает старый и выдаёт
новый в KARMAN → `/secrets`, затем обновить `/etc/trener/secrets-token.env` (прод) и `web/.env`
(локально), `sudo systemctl restart trener.service`.

## Безопасность

- Токен и значения секретов **никогда** не коммитятся (gitignore: `.env`, `.env.*`; токен-файл вне
  репо). Адрес эндпоинта — в `SECRETS_MANAGER_URL` рядом с токеном, в коде дефолта нет.
- Токен read-write скоупится только на проект trener — чужие секреты недоступны.
- Трафик к KARMAN — только HTTPS; адрес эндпоинта — в `SECRETS_MANAGER_URL` (где он стоит — по реестру Мозга, в репо не лежит: D-038).
