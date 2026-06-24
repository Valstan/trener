---
description: Старт сессии — синхра своего репо (#032) + mailbox-check от brain + чтение SESSION_HANDOFF
---

Выполни старт сессии «trener» строго по шагам (детали — в `CLAUDE.md` §📬 Mailbox check). Порядок жёсткий: **сначала синхронизация (шаги 1–2), потом чтение session-памяти (шаг 5)** — pool #032.

1. **Sync свой репо — ПЕРВЫМ:** `git fetch`; если working tree чист и есть отставание — `git checkout main && git pull --ff-only`. Незакоммиченное / не-ff — сообщи и не форсируй. Только после этого можно доверять `SESSION_HANDOFF`.
2. **Sync brain (read-only):** `cd ../brain_matrica && git pull --ff-only && cd -`. Если не ff — сообщи и не форсируй.
3. **Скан входящих:** прочитай файлы в корне `../brain_matrica/mailboxes/trener/from-brain/*.md` (НЕ `DRAFTS/`, НЕ `ARCHIVE/`).
4. **Доложи** пользователю сводку писем ДО чтения handoff, в формате:
   ```
   📬 N писем от brain_matrica:
   - [urgency COMPLIANCE] YYYY-MM-DD-slug — тема
   ```
   `urgency: high` — выдели отдельно даже если письмо одно. Для писем без `compliance`: `kind: directive`→MUST, `kind: idea`→SHOULD.
5. **Прочитай** `docs/SESSION_HANDOFF.md` — статус, текущая нитка, следующий шаг. Если `Updated:` старше 14 дней — пометь «handoff может быть неактуален», не доверяй слепо.
6. **Re-триаж отложенного (#033, если ведётся):** если есть `docs/PENDING_FOLLOWUPS.md` — пункты с возрастом `added` > 30 дней ИЛИ `snoozed` ≥ 3× всплыви пользователю (возобновить / переформулировать под текущий код / выкинуть с причиной). Остальные не перечисляй. Нет файла — шаг пропусти.
7. **Сводка main:** `git log --oneline -5` и `git status` — что нового, есть ли незакоммиченное.
8. Кратко предложи пользователю следующий шаг из handoff.

Не начинай правки кода до завершения шагов 1–5.
