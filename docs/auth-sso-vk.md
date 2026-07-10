# Вход через VK по единому центру авторизации «Радар» (проект Сарафан)

> Статус: **РЕАЛИЗОВАНО (2026-07-10).** Контракт §4 ратифицирован Мозгом 2026-06-30
> «как есть, без правок» (`brain_matrica/mailboxes/trener/from-brain/2026-06-30-radar-sso-ratified-you-are-pilot.md`);
> Радар-ID Ф1 задеплоен и live (`вход.вмалмыже.рф`, punycode
> `xn--b1ae3a1a.xn--80adkdyec4j.xn--p1ai`); клиент `trener` зарегистрирован
> (confidential, redirect'ы прод + localhost:3000). Сторона trener построена по §3:
> `lib/auth/oidc.ts` (discovery/PKCE/JWKS-валидация), `lib/auth/radarLink.ts`
> (связывание §3.3), маршруты `/auth/vk/start|callback`, кнопка на `/login`
> (env-gated: `RADAR_ISSUER_URL`+`RADAR_CLIENT_ID`+`RADAR_CLIENT_SECRET`).
> Хвост: адаптация invite-флоу под VK-аккаунты (§3.4) — отдельным PR.
>
> Решения владельца (2026-06-29): охват — **все роли через VK**; magic-link —
> **сосуществует**.

## 1. Зачем

Единый вход VK для всех проектов владельца через центр авторизации **Радар** (модуль
проекта **Сарафан**). trener — первый/один из первых клиентов. Для родителей VK снимает
трение онбординга; для всех — единая личность между проектами.

## 2. Ключевая особенность trener (почему VK ≠ «просто прикрутить»)

1. **VK даёт «кто человек», а НЕ «чей он родитель».** Ядро корректности trener —
   привязка `родитель → ребёнок` и `тренер → группа` (на ней держатся coverage «N из M»
   и 152-ФЗ-скоупинг, см. [`m2-core-design.md`](m2-core-design.md), #015). VK-вход
   удостоверяет личность, но не знает, что Ольга — мама Артёма. **Шаг привязки
   (приглашение тренером) остаётся.** VK заменяет «доказательство личности» (роль
   magic-link), но не «привязку к ребёнку» (роль invite).
2. **152-ФЗ.** Согласие на обработку детских ПДн — отдельный осознанный акт (не из VK).
   VK-вход его не отменяет: онбординг-согласие остаётся гейтом для родителя. У Радара
   запрашиваем **минимум** claim'ов (стабильный `sub`, email, имя) — минимизация.

## 3. Архитектура стороны trener

### 3.1 Мост сессии — уже есть
[`lib/auth/session.ts`](../web/src/lib/auth/session.ts) `buildAuthCookie(payload, user)`
выписывает **стандартную Payload-сессию** (sid + cookie `payload-token`) по userId, без
пароля. Тот же путь, что у magic-link. Значит VK-флоу заканчивается тем же вызовом →
сессия работает **и на фронте, и в `/admin`**. Поэтому «все роли через VK» достижимо без
отдельного admin-SSO: VK-юзер с ролью admin/coach, получив cookie, уже авторизован в
админке (email+пароль остаётся fallback'ом).

### 3.2 Маршруты (добавляются)
- `GET /auth/vk/start` — строит authorize-URL Радара (state + PKCE + nonce в
  httpOnly-cookie), редиректит в Радар.
- `GET /auth/vk/callback` — проверяет state, меняет code → токены, валидирует id_token
  (подпись по JWKS, nonce, aud, exp), достаёт `sub`+email+имя → `findOrLinkUser` →
  `buildAuthCookie` → редирект `homePathForUser(user)` ([`lib/auth/home.ts`](../web/src/lib/auth/home.ts)).

### 3.3 Связывание аккаунта (`findOrLinkUser`)
- В `users` добавляется связь с внешней личностью: `authProvider` (напр. `'radar'`) +
  `externalId` (= стабильный `sub` Радара). Индекс `(authProvider, externalId)` уникален.
- Поиск: сначала по `(provider, sub)`; если нет — по **подтверждённому** email
  (`email_verified`) ищем существующего юзера и **привязываем** к нему VK-личность; если
  и его нет — создаём нового с ролью по умолчанию `parent`.
- **Анти-захват аккаунта:** связывание по email — только при `email_verified=true` от
  Радара. Иначе VK-аккаунт с чужим невериф. email мог бы «прилипнуть» к существующему
  персоналу. Если email не подтверждён — не связываем, заводим отдельного юзера.
- Роли trener назначает **локально** (Радар их не диктует): новый VK-юзер → `parent`;
  повышение до coach/admin — вручную админом или через staff-инвайт. (Подтвердить у
  Радара, что он НЕ пушит роли — §4.)

### 3.4 Привязка к ребёнку (без изменений по сути)
Новый родитель, вошедший через VK без приглашения, детей не имеет → `/parent` пуст.
Привязка — через существующий invite тренера ([`lib/auth/invite.ts`](../web/src/lib/auth/invite.ts)).
Инвайт-флоу адаптируется: при приёме приглашения, если юзер уже вошёл через VK, привязать
ребёнка к этому VK-аккаунту (а не плодить второй по email).

### 3.5 Сосуществование с magic-link
magic-link и invite **остаются**. На `/login` добавляется кнопка «Войти через VK»,
видимая только когда SSO сконфигурирован (env-флаг) — в dev без Радара вход работает как
сейчас. VK — аддитивный путь, не замена.

## 4. Контракт, который trener запрашивает у Радара

> Предлагаем **OIDC Authorization Code + PKCE** — индустриальный стандарт для SSO-центра,
> кросс-языковые клиенты, готовая валидация id_token. Если Радар выберет иной протокол —
> согласуем, но это поднимает стоимость каждого клиента.

1. **Discovery:** `issuer` + `/.well-known/openid-configuration` (или явные endpoints:
   `authorization_endpoint`, `token_endpoint`, `userinfo_endpoint`, `jwks_uri`).
2. **Регистрация клиента trener:** `client_id` + `client_secret`; разрешённые
   `redirect_uri`: `https://интер.вмалмыже.рф/auth/vk/callback` (прод) и
   `http://localhost:3000/auth/vk/callback` (dev).
3. **Flow:** authorization code + **PKCE** (S256), `state` (CSRF), `nonce` (replay).
4. **Claims (минимум):**
   - `sub` — **стабильный, уникальный** идентификатор личности (не меняется между
     входами; это якорь связывания). Желательно — содержащий/сопоставимый с VK user id.
   - `email` + `email_verified` (флаг критичен для §3.3 анти-захвата).
   - `name` (или `given_name`/`family_name`) — для отображения, не как ключ.
5. **id_token:** подписанный JWT (RS256), проверяемый по `jwks_uri`; `aud`=client_id,
   корректные `iss`/`exp`/`nonce`.
6. **Роли:** Радар **не** диктует роли проекта (trener назначает локально). Подтвердить.
7. **Logout (опц.):** RP-initiated logout endpoint, если будет единый выход.

## 5. Реализация (2026-07-10)

- **Поля `users`:** `authProvider` (select, пока только `radar`) + `externalId` (sub);
  compound-unique `(authProvider, externalId)`; field-access `create/update: adminField`
  (заполняет только серверный путь с `overrideAccess` — самопривязка чужого sub закрыта).
- **`lib/auth/oidc.ts`:** discovery с кэшем (+проверка `issuer`), PKCE S256, обмен кода
  (`client_secret_post`), `jose.jwtVerify` по remote-JWKS (iss/aud/exp/RS256) + nonce.
  Транзакция state/nonce/verifier между start и callback — httpOnly-cookie, подписанная
  HMAC(PAYLOAD_SECRET) (анти-tampering/cookie-tossing). Punycode-нормализация issuer и
  redirect_uri через WHATWG URL (G108: кириллический IDN в OAuth-конфиге).
- **`lib/auth/radarLink.ts`:** `findOrLinkRadarUser` по §3.3 + анти-захват №2: если
  аккаунт с verified-email уже связан с ДРУГИМ sub — не перепривязываем (отдельный юзер).
  Личность без пригодного email → детерминированный служебный адрес
  `radar-<sub>@sso.invalid` (email в auth-коллекции обязателен; вход — только VK).
- **Отказоустойчивость:** любой сбой флоу → мягкий redirect `/login?error=vk`,
  magic-link продолжает работать. Без RADAR_*-env маршруты отвечают 404, кнопки нет.

## 6. Следующие шаги
- Адаптация invite-флоу (§3.4): приём приглашения залогиненным VK-родителем без
  второго аккаунта по email — отдельным PR.
- Round-trip-смоук прод↔Радар после деплоя (остаток Ф1 на стороне setka — пинг Мозга).
