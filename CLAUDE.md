# CLAUDE.md — entry point для AI-сессий «trener»

Первый файл, который Claude читает в любой новой сессии этого проекта. Подсказывает, **где взять контекст** и **как правильно работать**.

Проект — координатор детской футбольной школы (расписание → уведомление об изменении → подтверждение родителя → coverage тренеру). Полный план, стек, модель данных, 152-ФЗ-floor и вехи: [`../brain_matrica/docs/plans/trener-kickoff.md`](../brain_matrica/docs/plans/trener-kickoff.md). Реестровая карточка: [`../brain_matrica/projects/trener.md`](../brain_matrica/projects/trener.md).

> **Bootstrap-статус (2026-06-24):** репо только заведён, каркаса приложения ещё нет. Первый build — **M1** по kickoff §8. Этот CLAUDE.md описывает правила работы и почту; он дополнится project-doc'ами (SESSION_HANDOFF растёт сам) по ходу постройки.

---

## 📬 Mailbox check — ДО любой другой работы (asymmetric scheme, ADR-0001 v3)

trener — под управлением meta-репо `brain_matrica` (`../brain_matrica/`). Идеи / директивы / вопросы brain ↔ проект ходят через **асимметричные mailbox'ы**: каждая сторона пишет **только в свой репо**. См. [ADR-0001 v3](../brain_matrica/adr/0001-brain-projects-mailboxes.md).

| Направление | Кто пишет | Где |
|---|---|---|
| `brain → trener` | brain | `brain_matrica/mailboxes/trener/from-brain/*.md` (мы только **читаем** через `git pull --ff-only`) |
| `trener → brain` | мы | **`mailbox/to-brain/*.md`** в этом репо (коммитим в свой через PR) |

### Шаги в начале каждой сессии (это и делает `/start`)

1. **Sync brain (read-only):** `cd ../brain_matrica && git pull --ff-only && cd -`
2. **Сканить** `../brain_matrica/mailboxes/trener/from-brain/*.md` (только корень — **не** `DRAFTS/`, **не** `ARCHIVE/`).
3. **Доложить** пользователю **до** чтения `docs/SESSION_HANDOFF.md`:
   ```
   📬 N писем от brain_matrica:
   - [high MUST]     2026-MM-DD-slug — short topic
   - [normal SHOULD] 2026-MM-DD-slug — short topic
   - [low MAY]       2026-MM-DD-slug — short topic
   ```
   `[urgency COMPLIANCE]`: **urgency** (`high`/`normal`/`low`) — когда читать; **COMPLIANCE** (`MUST`/`SHOULD`/`MAY`) — насколько обязательно. `urgency: high` упоминать отдельно даже если письмо одно.
4. **Retroactive** для писем без поля `compliance`: `kind: directive` → **MUST**, `kind: idea` → **SHOULD**.

### Реакция по compliance

| compliance | RFC 2119 | Действие |
|---|---|---|
| `mandate` | MUST | Применить безусловно. Технически невозможно → `mailbox/to-brain/` с `kind=feedback`, `urgency=high`, конкретный блокер. |
| `recommend` | SHOULD | Применить (можно с адаптацией). Совсем не подходит → письмо с обоснованием отказа. Молчать нельзя. |
| `suggest` | MAY | По усмотрению. Применил — feedback приветствуется. Отложил — молча. |

### Чтобы написать brain (исходящие — в свой репо)

Создать `mailbox/to-brain/YYYY-MM-DD-slug.md` **в этом репо** (НЕ в `brain_matrica/`):

```yaml
---
from: trener
to: brain
date: YYYY-MM-DD
topic: ...
kind: idea | directive | question | feedback | report
compliance: suggest | recommend | mandate   # required для kind=idea и kind=directive
urgency: low | normal | high
ref:
  - brain_matrica/mailboxes/trener/from-brain/<filename>.md   # если отвечаешь
---
```

Закоммитить **в свой репо через PR**. Brain прочитает через `git pull --ff-only` со своей стороны. См. [`mailbox/README.md`](mailbox/README.md).

### Проактивный шеринг находок (pool #009)

Значимые **переносимые** находки (новый паттерн / обход бага фреймворка / security-приём) отправляю в `mailbox/to-brain/` с `kind=idea` **сам**, не дожидаясь запроса. 3-фильтр: значимость / переносимость / неочевидность. **Тишина = норма** (рутинный фикс / бамп / доменная правка → молчим).

### Что НЕЛЬЗЯ

- ❌ Писать/коммитить в `../brain_matrica/` что-либо (brain — **read-only** для этой сессии; только `git pull --ff-only`).
- ❌ Писать в `brain_matrica/mailboxes/trener/to-brain/` — такой папки нет, brain принимает только из нашего `mailbox/to-brain/`.
- ❌ Архивировать `from-brain/*` — это забота brain'а в его репо.
- ❌ Писать письма другим проектам напрямую — идея в pool идёт письмом в свой `mailbox/to-brain/` с `kind=idea`.
- ❌ Пропускать mailbox-check в начале сессии.

### Consult-library reflex (pool #014) — по условному триггеру, не на каждый /start

Перед вводом нового инструмента/паттерна или при незнакомой грабле — заглянуть в библиотеку Мозга: [`cross-project-ideas/INDEX.md`](../brain_matrica/cross-project-ideas/INDEX.md) (pool), [`GOTCHAS.md`](../brain_matrica/cross-project-ideas/GOTCHAS.md) (грабли по симптому), [`REFERENCE.md`](../brain_matrica/cross-project-ideas/REFERENCE.md) (рецепты Payload+Next). **Особенно** как третий Payload-проект: GOTCHAS G6/G7/G25/G27/G35 (Payload-миграции/медиа), G59 (PWA-manifest на public-пути), G12 (manifest/robots в корне `app/`), G17/G20 (standalone/мелкий VPS).

---

## Стек и принципы (из kickoff)

- **Бэкенд:** Payload CMS + Next.js + PostgreSQL (= GONBA/Sabantuy, 1:1). **Клиент:** PWA на React/Next.
- **Пуш — best-effort.** Корректность держится на **in-app очереди «непринятых» + coverage-экране тренера**, не на пуше. iOS APNs web-push (16.4+, Declarative Web Push 18.4+) / Android FCM HTTP v1 + VAPID, изменения слать high-priority. Legacy FCM server-key API не использовать (мёртв с сер. 2024).
- **152-ФЗ детских данных — day-1 floor** (kickoff §5): согласие отдельной бумагой (не чекбокс), уведомление РКН до go-live, РФ-локализация первой записи, минимизация (только имя+группа+контакт родителя). Authz по ролям (#015) day-1.
- **Flow:** PR-only на main (ADR-0002), ветки `feat/`/`fix/`/`chore/`/`docs/`. Секреты вне репо `/etc/trener/trener.env` (#008). Deploy-smoke (#011).
- **Две машины разработки (#050):** работа (`PC40`, `D:\GitHubReps\`) и дом (`rmz4val`, `D:\PROGRAMMING\`) поочерёдно; GitHub — источник истины (#010). Локальное окружение машины (порт/доступ dev-БД, нюанс pnpm, грабли) — в [`docs/machines/<hostname>.md`](docs/machines/README.md); `/start` читает по hostname. Незапушенную работу между машинами не оставлять.

## Вехи (kickoff §8)

M1 каркас + 152-ФЗ floor → M2 ядро (изменение→пуш→ack→coverage + RSVP) → M3 объявления + «вопрос тренеру» + деплой = **первый прод** → M4 fast-follow полный чат.
