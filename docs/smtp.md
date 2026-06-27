# SMTP — отправка писем (magic-link входа)

Письма входа/онбординга (magic-link) и будущие уведомления уходят через внешний
SMTP-relay. **Код полностью готов** — настройка чисто операционная: задать `SMTP_*`
в `/etc/trener/trener.env` на проде → перезапустить сервис → проверить доставку.

## Как это устроено в коде

- `web/src/payload.config.ts` — подключает `nodemailerAdapter` **только если задан
  `SMTP_HOST`**. Пусто → адаптера нет, Payload пишет письма в консоль (dev/CI: WARN
  «No email adapter»), сборка/типы зелёные без секретов.
- `web/src/lib/email/magicLinkEmail.ts` — шлёт через `payload.sendEmail` (best-effort:
  ошибка отправки НЕ пробрасывается наружу — иначе по «упало/не упало» можно вычислить,
  существует ли email, это enumeration). В dev ссылка дополнительно логируется.
- Ссылки в письмах строятся от `NEXT_PUBLIC_SERVER_URL` — на проде это публичный
  HTTPS-домен школы, иначе verify-ссылка будет битой.

## Переменные (`/etc/trener/trener.env`, #008)

| Переменная | Назначение | Пример |
|---|---|---|
| `SMTP_HOST` | хост relay (включает адаптер) | `smtp.yandex.ru` |
| `SMTP_PORT` | порт | `465` (SSL) или `587` (STARTTLS) |
| `SMTP_SECURE` | implicit TLS | `true` для 465, `false` для 587/2525 (по умолчанию авто по порту) |
| `SMTP_USER` | логин SMTP | `school@вмалмыже.рф` |
| `SMTP_PASS` | пароль/ключ | пароль приложения (НЕ пароль от аккаунта) |
| `SMTP_FROM_ADDRESS` | от-адрес | `school@xn--80adkdyec4j.xn--p1ai` |
| `SMTP_FROM_NAME` | отображаемое имя | `Футбольная школа` |

> **152-ФЗ:** relay видит email родителя (ПДн). Поэтому выбран **российский / на своём
> домене** relay — ПДн остаются в РФ, без трансграничной передачи (ст.12). Зарубежные
> сервисы (Resend/SendGrid) для прод-данных детей не используем.

> **Грабля env-файла:** значения с пробелами (например `SMTP_FROM_NAME`) **обязательно
> в кавычках**: `SMTP_FROM_NAME="Футбольная школа"`. systemd `EnvironmentFile=` читает и
> без кавычек (берёт всю строку после `=`), но любой скрипт, который `source`-нёт файл,
> сломается на word-splitting (`школа: command not found`). Кавычки безопасны для обоих.

## Вариант A0 — существующий яндекс-ящик на своём домене (проще всего)

Если у вас **уже есть** почта на домене на Яндексе (напр. личный `name@example.ru`) —
ничего заводить не нужно: годится напрямую. Нужен только **пароль приложения**
(id.yandex.ru → Безопасность → Пароли приложений → «Почта») — обычный пароль аккаунта
по SMTP Яндекс не пустит. Параметры — как в варианте A (`smtp.yandex.ru:465 SSL`),
`SMTP_USER`/`SMTP_FROM_ADDRESS` = адрес ящика. DNS/DKIM уже настроены Яндексом.

## Вариант A — Yandex 360 для домена (рекомендуется)

Лучшая доставляемость в рунет (mail.ru/yandex/gmail), бесплатный тариф для малых
команд, корректно работает с `.рф`-доменами и сам подписывает DKIM.

1. **Подключить домен** `вмалмыже.рф` в [Yandex 360 для бизнеса](https://360.yandex.ru/business/)
   → подтвердить владение (TXT-запись в DNS домена).
2. **DNS-записи** (там, где ведётся DNS домена — см. G104 про wildcard на owned-домене):
   - **MX** → на серверы Yandex (мастер подключения покажет точные значения).
   - **SPF** (TXT `@`): `v=spf1 redirect=_spf.yandex.net`.
   - **DKIM** (TXT) — значение даёт Yandex после подключения; включить подпись.
3. **Создать ящик** для отправки, например `school@вмалмыже.рф`.
4. **Пароль приложения**: Яндекс ID → Безопасность → Пароли приложений → создать для
   «Почты». Это и есть `SMTP_PASS` (обычный пароль от аккаунта по SMTP не подойдёт при
   включённой 2FA).
5. **Значения env:**
   ```
   SMTP_HOST=smtp.yandex.ru
   SMTP_PORT=465
   SMTP_SECURE=true
   SMTP_USER=school@вмалмыже.рф
   SMTP_PASS=<пароль приложения>
   SMTP_FROM_ADDRESS=school@xn--80adkdyec4j.xn--p1ai
   SMTP_FROM_NAME="Футбольная школа"
   ```

### Нюанс `.рф`-домена

Домен школы — кириллический (`вмалмыже.рф` = punycode `xn--80adkdyec4j.xn--p1ai`).
В `SMTP_FROM_ADDRESS` домен лучше писать **в punycode** — это валидный ASCII и
максимально совместимо с принимающими серверами (не все поддерживают SMTPUTF8).
`SMTP_USER` Yandex принимает в обоих видах. За счёт `SMTP_FROM_NAME` получатель видит
«Футбольная школа», а не сам адрес.

## Вариант B — почта на хостинге myjino

Если почта домена ведётся на myjino: завести ящик в панели myjino, взять параметры
SMTP оттуда (обычно `smtp.jino.ru`, порт 465 SSL), `SMTP_USER` — полный адрес ящика,
`SMTP_PASS` — его пароль. DNS (MX/SPF/DKIM) — по инструкции myjino. Остальное идентично.

## Применение на проде (SSH)

Секреты — только в `/etc/trener/trener.env` (root:0640), НЕ в репозитории. Дописать
блок и перезапустить сервис:

```bash
ssh GONBA
sudo tee -a /etc/trener/trener.env >/dev/null <<'EOF'

# SMTP (magic-link)
SMTP_HOST=smtp.yandex.ru
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=school@вмалмыже.рф
SMTP_PASS=<пароль приложения>
SMTP_FROM_ADDRESS=school@xn--80adkdyec4j.xn--p1ai
SMTP_FROM_NAME="Футбольная школа"
EOF
sudo systemctl restart trener.service
systemctl is-active trener.service
```

## Проверка (end-to-end)

Запросить magic-link на **существующего** пользователя (например, на email админа,
который заведён в /admin) и проверить инбокс:

```bash
curl -sS -X POST https://интер.вмалмыже.рф/auth/request-login \
  -H 'Content-Type: application/json' -d '{"email":"<email-существующего-юзера>"}'
# ответ всегда нейтральный (анти-enumeration) → смотрим сам ящик
```

Письмо «Вход в Футбольную школу» со ссылкой `…/auth/verify?token=…` должно прийти за
секунды. Если нет — смотреть логи сервиса:

```bash
ssh GONBA 'sudo journalctl -u trener.service -n 50 --no-pager | grep -i "magic-link\|email\|smtp"'
```

## Troubleshooting

| Симптом в логах | Причина | Лечение |
|---|---|---|
| `Invalid login` / `535` | неверный логин/пароль | для Yandex с 2FA — нужен **пароль приложения**, не пароль аккаунта |
| `5.7.1 ... not allowed` / relay denied | from-адрес не на подключённом домене | `SMTP_FROM_ADDRESS` должен быть на домене ящика (`SMTP_USER`) |
| письма уходят в спам | нет/битый SPF/DKIM | проверить DNS-записи (mail-tester.com); дождаться прогрева репутации |
| `self signed certificate` / TLS | прокси/самоподписанный серт | проверить порт (465 vs 587) и `SMTP_SECURE` |
| `ECONNREFUSED` / таймаут | порт закрыт исходящим | разрешить исходящий 465/587 с бокса; проверить host |
| ссылка в письме на `localhost` | не задан прод-URL | `NEXT_PUBLIC_SERVER_URL` = HTTPS-домен (уже задан на проде) |

## Связанное

- Шаблон переменных — `web/.env.example` (блок SMTP).
- Секреты вне репо — pool #008; деплой подключает файл через `EnvironmentFile=`.
