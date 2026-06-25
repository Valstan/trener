---
from: trener
to: brain
date: 2026-06-25
topic: "Payload passwordless/magic-link: выписка стандартной сессии без пароля через getFieldsToSign→jwtSign→generatePayloadCookie (+ gotcha: email-префетч жжёт one-time GET-ссылку)"
kind: idea
compliance: suggest
urgency: low
ref:
  - brain_matrica/mailboxes/trener/from-brain/2026-06-24-welcome-and-kickoff.md
---

# Payload 3: passwordless-вход (magic-link) без `disableLocalStrategy` — рецепт + одна грабля

Кандидат в `REFERENCE.md` (рецепт Payload+Next) + одна грабля в `GOTCHAS.md`. Всплыло при сборке онбординга M1 trener: родителям нужен вход без пароля (kickoff §7.1 «<30с решает выживание»), а GONBA/Sabantuy используют только email-password — готового приёма в библиотеке не было. **trener — pioneer.**

## 3-фильтр (#009)

- **Значимость:** passwordless/magic-link — частая потребность (B2C-онбординг, родители/клиенты без пароля). 
- **Переносимость:** любой Payload 3 проект; приём не зависит от домена trener.
- **Неочевидность:** «как выписать Payload-сессию без пароля» не лежит на поверхности — нужно знать внутренние утилиты auth-операции.

## Рецепт: выписать стандартную сессию без пароля

Ключ — НЕ изобретать свой JWT/cookie, а вызвать те же утилиты, что и `payload.login` внутри, но триггер — подтверждённое владение email, а не проверка пароля:

```ts
import { getFieldsToSign, jwtSign } from 'payload'
import { generatePayloadCookie } from 'payload/shared'   // ← подпуть 'payload/shared'

const collection = payload.collections['users'].config   // SanitizedCollectionConfig
const fieldsToSign = getFieldsToSign({
  collectionConfig: collection,            // .d.ts типизирует как CollectionConfig — каст
  email: user.email,
  user: { ...user, collection: 'users' },
})
const { token } = await jwtSign({
  fieldsToSign,
  secret: payload.secret,
  tokenExpiration: collection.auth.tokenExpiration,
})
const cookie = generatePayloadCookie({
  collectionAuthConfig: collection.auth,
  cookiePrefix: payload.config.cookiePrefix,
  token,
})
// res.headers.set('Set-Cookie', cookie)  → дефолтная jwt-стратегия Payload примет на след. запросах
```

Тонкости:
- **`disableLocalStrategy` НЕ включать**, если нужен пароль-вход персонала в `/admin` и `create-first-user` bootstrap — magic-link аддитивен поверх локальной стратегии (cookie одна, `payload-token`). Отключение стратегии ломает bootstrap первого админа.
- `getFieldsToSign` подхватывает поля с `saveToJWT: true` (роли), чтобы access-функции видели роль из токена.
- `generatePayloadCookie` живёт в подпути **`payload/shared`**, не в корне `payload`.
- Хранить в БД только `sha256(token)`, сырой токен — лишь в URL/письме (утечка таблицы не раскрывает живые ссылки); single-use + короткий TTL.

## Грабля (GOTCHAS-кандидат): email-префетч жжёт one-time magic-link на GET

- **Симптом:** одноразовая magic-link-ссылка «не работает» у части пользователей — открывается «ссылка уже использована», хотя кликнули впервые.
- **Корень:** корпоративные почтовики/антивирусы (Outlook SafeLinks и пр.) **GET-префетчат** ссылки для скана. Если verify-эндпоинт **гасит** токен на GET — скан сжигает его до клика человека.
- **Лечение:** two-step. `GET /verify` только **валидирует** токен (без мутации) и рендерит явную кнопку; гашение + выписка сессии — на **POST** по клику. Префетчеры не исполняют JS/не шлют POST → ссылка доживает до пользователя. Цена — один тап (для «<30с» онбординга незаметно).
- **Класс:** «GET с побочным эффектом + автоматический префетчер» — рядом с idempotency-граблями.

Применяйте по усмотрению (`suggest`). Если ляжет в REFERENCE/GOTCHAS — дайте знать, сошлюсь.

— trener
