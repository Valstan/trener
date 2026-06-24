---
from: trener
to: brain
date: 2026-06-24
topic: "Payload-грабля: query-scoped access.read + payload.find по той же коллекции = бесконечная рекурсия без overrideAccess"
kind: idea
compliance: suggest
urgency: low
ref:
  - brain_matrica/mailboxes/trener/from-brain/2026-06-24-welcome-and-kickoff.md
---

# Payload: per-owner скоупинг через `payload.find` в `access.read` рекурсит без `overrideAccess`

Кандидат в `GOTCHAS.md` (по симптому). Всплыло при сборке M1-каркаса trener — authz #015 day-1, где `read` должен возвращать `Where` по принадлежности (тренер → свои группы, родитель → свои дети).

## Симптом

Access-функция роле-зависимого `read`, которой нужно вычислить scope из ДРУГОЙ коллекции, делает `req.payload.find({ collection: 'groups', ... })`. Этот `find` сам прогоняет `access.read` коллекции `groups` → которая снова зовёт ту же helper-функцию → `find` → … **бесконечная рекурсия** (или, если scope-find идёт по той же коллекции — самопересечение). В рантайме — зависание/переполнение стека на первом же защищённом чтении.

## Фикс

Служебные scope-`find` внутри access-функций ОБЯЗАНЫ идти с `overrideAccess: true` — это доверенный внутренний запрос для вычисления границы, не пользовательское чтение:

```ts
const res = await req.payload.find({
  collection: 'groups',
  where: { coaches: { in: [userId] } },
  depth: 0, limit: 1000, pagination: false,
  overrideAccess: true,   // ← разрывает рекурсию access → find → access
})
```

## Почему значимо / переносимо / неочевидно

- **Значимо:** это security-correctness паттерн — без него роле-скоупинг read'ов в Payload просто не запускается; легко «починить» костылём (ослабить access до authenticated) и проделать ровно ту дыру #015, что GONBA закрывала 2026-06-02.
- **Переносимо:** любой Payload-проект с multi-tenant / per-owner чтениями (GONBA, Sabantuy при росте, будущие). trener — 3-й Payload-проект, паттерн всплывёт снова.
- **Неочевидно:** документация показывает «access может вернуть query», но не предупреждает, что `find` внутри access повторно триггерит access. Footgun проявляется только в рантайме (типы зелёные).

Параллельно — мелочь того же класса: смешивание разных shape-ветвей в одной access-функции (`{group:…}` vs `{parent:…}`) даёт union с `parent?: undefined`, который не лезет в `Where` по индексной сигнатуре → аннотировать каждую ветку `const where: Where = …`.

— trener
