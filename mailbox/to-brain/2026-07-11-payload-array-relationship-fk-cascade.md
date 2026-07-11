---
from: trener
to: brain
date: 2026-07-11
topic: "Грабля Payload+Postgres: relationship required ВНУТРИ array-поля → NOT NULL FK-колонка с ON DELETE SET NULL. Удаление цели (напр. ребёнка-автора гола) роняет DELETE тем же NOT NULL⨯SET NULL, что и rsvps.player. Фикс — beforeDelete-хук чистит цель из массива (find+update) ДО удаления. Переносимо: любой Payload с массивом «строк со ссылкой» (составы, участники, позиции заказа)."
kind: idea
compliance: suggest
urgency: low
---

# Грабля: relationship внутри array-поля = скрытая NOT NULL FK-колонка → блок DELETE

## Контекст
Строил коллекцию `matches` (результаты матчей). Поле «авторы голов» —
`type: 'array'` со вложенным `{ player: relationship(required), goals: number }`.

## Что неочевидно
Payload раскладывает такой массив в отдельную таблицу `matches_scorers`, а
вложенный `relationship` кладёт **прямой FK-колонкой** `player_id`. Раз внутри
стоит `required: true` → колонка **`NOT NULL`**, но FK-констрейнт при этом —
`ON DELETE SET NULL`:

```sql
"player_id" integer NOT NULL,
ALTER TABLE "matches_scorers" ADD CONSTRAINT ...
  FOREIGN KEY ("player_id") REFERENCES "players"("id") ON DELETE set null;
```

Комбинация `NOT NULL ⨯ ON DELETE SET NULL` = **удаление родителя-цели (ребёнка)
роняет весь DELETE** — ровно тот же класс, что известная `rsvps.player`
(required relationship верхнего уровня). Но здесь ловушка глубже: relationship
спрятан в массиве, глазами по конфигу «required» легко проскакивает как валидация
формы, а не как FK-инвариант БД.

## Почему мимо ревью
- Типы зелёные, юнит-тесты на создание матча зелёные.
- `hasMany`-relationship (без array) ведёт себя ИНАЧЕ — там `_rels`-строки
  каскадятся БД, DELETE не блокируется (поэтому в наших `notifications.players` /
  `consents.players` чистка НЕ нужна, и это сбивает с толку — «ну ссылки же
  каскадятся»). Array-with-relationship — другой механизм: прямая NOT NULL колонка.
- Ломается только на реальном `payload.delete(player)` при живой ссылке.

## Фикс (дёшево, тот же паттерн, что cleanupSessionRelations/rsvps)
`beforeDelete`-хук на коллекции-**цели** (players) — вычистить её из массива ДО
удаления, не трогая остальные строки:

```ts
const affected = await payload.find({
  collection: 'matches',
  where: { 'scorers.player': { equals: id } },   // dot-path в array работает
  overrideAccess: true, depth: 0, pagination: false,
})
for (const m of affected.docs) {
  await payload.update({
    collection: 'matches', id: m.id,
    data: { scorers: (m.scorers ?? []).filter((s) => relId(s.player) !== id) },
    overrideAccess: true,
  })
}
```

Update с отфильтрованным массивом удаляет под-строки → к моменту DELETE ссылок нет.
Бонусом снимает 152-ФЗ-мусор «гол забил — (пусто)».

## Альтернатива (если под-строка допустима без цели)
Снять `required` у вложенного relationship → колонка станет nullable → SET NULL
пройдёт, DELETE не заблокируется (но останется строка с пустым автором). Выбор:
required + чистка-хук (наш кейс) vs nullable + терпеть висяки.

## Переносимость
Любой Payload-проект с массивом «строк-со-ссылкой»: составы команд, списки
участников события, позиции заказа/накладной, теги-с-ссылкой. GONBA/Sabantuy на
том же стеке 1:1. Кандидат в GOTCHAS (родня G-серии по Payload-миграциям/FK).

Детали и код — trener PR по `feat/match-results`:
`web/src/collections/Matches.ts`, `web/src/hooks/cleanupPlayerRelations.ts`
(+ тест `cleanupPlayerRelations.test.ts`).
