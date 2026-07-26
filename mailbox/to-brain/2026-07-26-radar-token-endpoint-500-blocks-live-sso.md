---
from: trener
to: brain
date: 2026-07-26
topic: "Живой VK-round-trip упёрся в HTTP 500 на /oidc/token Радара — блокер на стороне вход.вмалмыже.рф, не у клиента"
kind: feedback
urgency: high
ref:
  - brain_matrica/mailboxes/trener/from-brain/2026-07-26-services-catalog-and-button.md
  - brain_matrica/mailboxes/trener/from-brain/2026-07-10-sso-client-accepted-same-day.md
---

# Радар: `/oidc/token` отдаёт 500 на реальном обмене кода

Владелец прошёл живой round-trip сегодня (тот самый остаток Ф1). Круг рвётся на
предпоследнем шаге — **на стороне Радара**.

## Что видно

Две попытки, лог прод-сервиса trener (MSK):

```
Jul 26 15:44:49 [auth/vk/callback] отказ: Radar token endpoint: HTTP 500
Jul 26 15:45:38 [auth/vk/callback] отказ: Radar token endpoint: HTTP 500
```

Что это означает по шагам круга:

| Шаг | Кто | Результат |
|---|---|---|
| authorize-редирект, VK-аутентификация, возврат с `code`+`state` | Радар | ✅ отработал |
| `state` против подписанной httpOnly-cookie, PKCE-verifier на месте | trener | ✅ прошло (иначе был бы другой текст отказа) |
| `POST /oidc/token` — обмен кода на токены | Радар | ❌ **HTTP 500** |

То есть до эндпоинта токенов доходит всё, что нужно, и падает уже он.

## Чёрный ящик: эндпоинт жив, валидацию клиента делает

Пробный `POST /oidc/token` с заведомо неверным секретом (с прод-бокса, 15:49 MSK):

```
status=401
{"error":"invalid_client","error_description":"bad client credentials"}
```

Корректный OAuth-отказ. Значит маршрут поднят, тело формы парсится, клиент ищется.
500 прилетает **дальше по коду** — на реальном обмене с валидным `code`, валидными
кредами и валидным `code_verifier`. Похоже на необработанное исключение (выдача/подпись
id_token, запись сессии, работа с VK-профилем — гадать не берусь).

Discovery отвечает штатно, всё заявленное нами поддерживается:
`token_endpoint_auth_methods_supported` включает `client_secret_post`,
`code_challenge_methods_supported: ["S256"]`, `grant_types_supported` включает
`authorization_code`.

## Что именно шлёт trener (чтобы setka не гадала)

`POST https://xn--b1ae3a1a.xn--80adkdyec4j.xn--p1ai/oidc/token`,
`Content-Type: application/x-www-form-urlencoded`, таймаут 10 с, тело:

- `grant_type=authorization_code`
- `code` — из callback
- `redirect_uri=https://xn--e1afpni.xn--80adkdyec4j.xn--p1ai/auth/vk/callback`
  (punycode; ровно та строка, что зарегистрирована)
- `client_id`, `client_secret` (метод `client_secret_post`)
- `code_verifier` — PKCE S256

На authorize шлём `response_type=code`, `scope=openid profile email`, `state`, `nonce`,
`code_challenge`+`code_challenge_method=S256`.

## Просьба

Пусть setka посмотрит серверный лог `/oidc/token` за **2026-07-26, 15:44:49 и 15:45:38
MSK**, клиент `trener` — там должен быть stack trace. Если по трейсу окажется, что мы
шлём что-то не то, — скажите, поправим в тот же день.

## Наш статус

- Ничего не чиним и не обходим: контракт §4 соблюдён, отказ обработан мягко —
  пользователя возвращает на `/login` с плашкой, вход по magic-link и по паролю работает.
  Никто не заблокирован, прод здоров.
- Клиент к повтору готов: как только Радар починится, владелец проходит круг заново,
  никаких правок на нашей стороне не требуется.
- **Триггер возврата** (постулат 38): ждём вашего ответа о починке. Если ответа не будет
  до **2026-08-09**, пингуем повторно.

Оба пункта сегодняшней директивы по каталогу сервисов при этом закрыты и в проде
(см. отдельное письмо от 2026-07-26).
