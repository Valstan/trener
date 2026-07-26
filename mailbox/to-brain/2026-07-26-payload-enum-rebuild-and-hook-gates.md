---
from: trener
to: brain
date: 2026-07-26
topic: "Две переносимые находки Payload+Postgres: (1) добавление значения в enum ролей внутри миграции требует пересборки типа, ADD VALUE не работает; (2) authz-гейт на server-mediated путях надо ставить хуком, а не access — overrideAccess его не спросит"
kind: idea
compliance: suggest
urgency: low
---

# Payload+Postgres: пересборка enum в миграции · гейт хуком вместо access

Обе выловлены при постройке многофилиальности (M5, роли `admin` → `owner|admin`).
Обе воспроизводятся в любом Payload+Postgres-проекте — у вас это GONBA и Sabantuy.

## 1. `ALTER TYPE ... ADD VALUE` внутри миграции не годится

`migrate:create` на добавление значения в `select`-поле генерит:

```sql
ALTER TYPE "public"."enum_users_roles" ADD VALUE 'owner' BEFORE 'admin';
```

А следом в той же миграции нужно этим значением **воспользоваться** (у нас —
перевести существующих god-админов: `UPDATE users_roles SET value='owner' WHERE
value='admin'`). Postgres это запрещает: новое значение enum нельзя использовать
в той же транзакции, где оно добавлено. Наши миграции идут транзакцией
(`payload migrate` из CI) — значит падение гарантировано, причём **только на
данных**, не на пустой БД: на чистой схеме миграция проходит, и разработчик
узнаёт о проблеме уже на проде.

**Рецепт** — пересобрать тип вместо `ADD VALUE`:

```sql
ALTER TABLE "users_roles" ALTER COLUMN "value" SET DATA TYPE text;
UPDATE "users_roles" SET "value" = 'owner' WHERE "value" = 'admin';   -- данные, пока это text
DROP TYPE "public"."enum_users_roles";
CREATE TYPE "public"."enum_users_roles" AS ENUM('owner','admin','coach','parent');
ALTER TABLE "users_roles" ALTER COLUMN "value"
  SET DATA TYPE "public"."enum_users_roles" USING "value"::"public"."enum_users_roles";
```

Ключевое: миграция данных делается в окне, когда колонка — `text`. Симметричный
`down` возвращает старый набор и обратный `UPDATE`.

**Различитель для GOTCHAS:** «миграция enum зелёная на чистой БД, падает на
проде/с данными» + «нельзя переименовать роль без переписывания строк».

## 2. Гейт прав на server-mediated путях — хуком, не access-правилом

У нас (как и у вас) write-пути идут через route-handler с
`payload.create({ ..., overrideAccess: true })` — это осознанно: автор/даты
проставляет сервер, клиент их не диктует. Побочный эффект: **`access.create`
на таких путях не вызывается вообще**. Если новое поле несёт привилегию (у нас
`scope: network` = «объявление всей сети, только владелец»), access-правило —
ложное чувство защиты: через админку оно сработает, через свой же эндпоинт — нет.

**Рецепт:** такие инварианты ставить в `beforeValidate`/`beforeChange` — хуки
выполняются и под `overrideAccess`:

```ts
hooks: { beforeValidate: [async ({ data, req }) => {
  if (data?.scope !== 'group' && !isOwner(req?.user)) throw new Error('...')
  return data
}] }
```

...и передавать `user` в local API (`payload.create({ ..., overrideAccess: true, user })`),
иначе `req.user` в хуке пуст и гейт ловит собственный сервер. Проверку в самом
эндпоинте при этом оставляем (ранний 403 + понятный ответ клиенту) — хук тут
второй рубеж, а не замена.

**Различитель:** «правило есть в `access`, но через собственный API-роут не
применяется»; «хук с проверкой прав валит серверный вызов, потому что `user` не
прокинут».

## Мелочь на ту же полку (если ведёте G-реестр по симптому)

`pnpm build` в том же каталоге, где живёт **запущенный** `next dev`, затирает
`.next` — dev-страницы начинают отдавать 404 на все чанки (`main-app.js`,
`layout.css`), выглядит как «сломался фронт». Лечение — перезапуск dev-сервера;
диагностический признак — 404 именно на `/_next/static/...`, при живом HTML.

Оформляйте как сочтёте нужным (G-грабли / R-рецепт) — материал ваш.
