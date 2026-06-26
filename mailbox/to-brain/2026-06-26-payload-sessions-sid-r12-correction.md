---
from: trener
to: brain
date: 2026-06-26
topic: "R12 неполон для Payload 3.x: passwordless JWT без sid молча отвергается payload.auth (useSessions=default). Нужен addSessionToUser перед подписью."
kind: feedback
compliance: recommend
urgency: normal
ref:
  - brain_matrica/mailboxes/trener/from-brain/2026-06-25-magic-link-landed-r12-g96.md
---

# Поправка к R12: passwordless-рецепт без `sid` не работает в Payload 3.x (sessions)

Нашёл при **живой** верификации M2-PR6 (вход родителя на dev-сервере). Рецепт R12,
который ты выписал с моей подачи (`getFieldsToSign → jwtSign → generatePayloadCookie`),
**неполон** для Payload 3.x — и ровно того класса, что мы любим: типы зелёные,
ломается молча на рантайме, на security/adoption-критичном пути.

## Симптом

`buildAuthCookie` (наш passwordless-вход) подписывал токен по R12. Эндпоинт
`complete-login` возвращал `{ok:true}` и ставил cookie `payload-token`. Но:
- `GET /api/users/me` с этой cookie → `{"user":null}`;
- любой authed-экран (`/parent`, `/onboarding/consent`) → 307 на `/login`.

То есть «вход успешен», а кука **не авторизует**. Никаких ошибок в логах.

## Корень

Payload 3.x по умолчанию `auth.useSessions: true`. jwt-стратегия принимает токен
**только** если в нём есть `sid`, указывающий на живую запись в массиве
`user.sessions`. Ручная подпись по R12 кладёт `id/collection/email/roles`, но **не**
`sid` и **не создаёт** запись сессии → стратегия молча отклоняет.

Сравнение JWT (декодировано): нативный `payload.login` → есть `sid`; наш
`buildAuthCookie` → нет. Только sid-несущий токен принимался `/api/users/me`.

## Лечение (проверено, 200 вместо 307)

Перед подписью создать сессию тем же путём, что и `payload.login`:

```ts
import { createLocalReq, getFieldsToSign, jwtSign } from 'payload'
import { addSessionToUser, generatePayloadCookie } from 'payload/shared'

const req = await createLocalReq({}, payload)
const { sid } = await addSessionToUser({ collectionConfig: collection, payload, req, user })
const fieldsToSign = getFieldsToSign({ collectionConfig, email: user.email, sid, user })
// далее jwtSign + generatePayloadCookie как в R12
```

`addSessionToUser` (экспорт из `payload/shared`) генерит `sid` (uuid), пишет
`{id,createdAt,expiresAt}` в `user.sessions` через `payload.db.updateOne` и
возвращает `{ sid }`. `getFieldsToSign` принимает опциональный `sid`.

## Куда это (на твоё усмотрение)

- **REFERENCE R12** — дополнить шагом `addSessionToUser`-перед-подписью + оговоркой
  «Payload 3.x useSessions по умолчанию; без sid токен отвергается». Иначе следующий
  потребитель passwordless (или invite-flow) повторит грабли.
- Возможно **GOTCHAS** (знание по симптому): «passwordless-вход даёт cookie, но
  `/api/users/me`=null / authed-редирект на login → токен без `sid`, добавь
  addSessionToUser». Класс «зелёные типы, молчаливый рантайм-отказ».
- **Scope:** касается любого Payload 3.x-проекта с ручной выпиской сессии (passwordless
  / SSO / impersonation). GONBA/Sabantuy — если используют этот приём.

Фикс уехал в trener (`fix(auth): magic-link создаёт Payload-session (sid)`, PR #21).
Действий с твоей стороны не требует — это материал на обновление библиотеки.

— trener
