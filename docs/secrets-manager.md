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
| Прод (бокс) | `/etc/trener/secrets-token.env` (root:valstan 0640), подключается отдельным `EnvironmentFile=-` в `trener.service` | вне репо (#008) |
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

Эндпоинт: `https://831d0ce99bdf.vps.myjino.ru/api/secrets` (дефолт зашит в коде; переопределяется
`SECRETS_MANAGER_URL`). Полный контракт — [`../../karman/docs/secrets-client-guide.md`](../../karman/docs/secrets-client-guide.md).

```bash
# Прочитать все (имена+значения видны только по валидному токену):
curl -H "Authorization: Bearer $SECRETS_TOKEN" https://831d0ce99bdf.vps.myjino.ru/api/secrets
# Один ключ:
curl -H "Authorization: Bearer $SECRETS_TOKEN" "https://831d0ce99bdf.vps.myjino.ru/api/secrets?key=PAYLOAD_SECRET"
# Сохранить/обновить (upsert):
curl -X POST https://831d0ce99bdf.vps.myjino.ru/api/secrets \
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
  fetch("https://831d0ce99bdf.vps.myjino.ru/api/secrets",{method:"POST",
    headers:{Authorization:"Bearer "+process.env.SECRETS_TOKEN,"Content-Type":"application/json"},
    body:JSON.stringify({secrets:s})}).then(async r=>console.log(r.status, await r.text()));
'
```

## Ручное восстановление (если env потерян, без рестарта приложения)

```bash
set -a; . /etc/trener/secrets-token.env; set +a
curl -s -H "Authorization: Bearer $SECRETS_TOKEN" https://831d0ce99bdf.vps.myjino.ru/api/secrets \
  | node -e 'const j=JSON.parse(require("fs").readFileSync(0,"utf8"));
      process.stdout.write(Object.entries(j.secrets).map(([k,v])=>
        /\s/.test(v)?`${k}="${v}"`:`${k}=${v}`).join("\n")+"\n");' \
  | sudo tee /etc/trener/trener.env >/dev/null
sudo chown root:valstan /etc/trener/trener.env && sudo chmod 0640 /etc/trener/trener.env
sudo systemctl restart trener.service
```

## Ротация токена

Токены KARMAN бессрочные. Если `SECRETS_TOKEN` утёк/потерян — владелец отзывает старый и выдаёт
новый в KARMAN → `/secrets`, затем обновить `/etc/trener/secrets-token.env` (прод) и `web/.env`
(локально), `sudo systemctl restart trener.service`.

## Безопасность

- Токен и значения секретов **никогда** не коммитятся (gitignore: `.env`, `.env.*`; токен-файл вне
  репо). В коде — только дефолтный URL эндпоинта (не секрет).
- Токен read-write скоупится только на проект trener — чужие секреты недоступны.
- KARMAN живёт на том же боксе (Бокс 1), что и trener-прод; трафик по HTTPS.
