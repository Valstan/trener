# trener — Session Handoff

> Sticky-note для непрерывности сессий. Перезаписывается `/close_session`. История через `git log -- docs/SESSION_HANDOFF.md`.

**Status:** ACTIVE
**Updated:** 2026-06-24 (bootstrap — репо заведён Мозгом, mailbox-канал подключён)
**Branch:** main

## Текущая нитка

Проект **только что заведён** из brain_matrica (репозиторий + mailbox-канал + реестровая карточка). Каркаса приложения ещё нет. Главный стартовый документ — [`../brain_matrica/docs/plans/trener-kickoff.md`](../brain_matrica/docs/plans/trener-kickoff.md).

## Следующий шаг

**M1 — каркас + 152-ФЗ day-1 floor** (kickoff §8):
1. Scaffold Payload+Next по образцу `../GONBA/` / `../SabantuyMalmyzh/`; коллекции Users/Players/Groups/TrainingSessions; роли (#015).
2. Онбординг magic-link (без пароля). PWA-клиент с установкой «на экран».
3. 152-ФЗ floor (kickoff §5): согласие отдельной бумагой (reuse `Registrations.ts` из Sabantuy), уведомление РКН до go-live, РФ-хостинг, политика, минимизация данных ребёнка.
4. PR-only flow; по готовности M1 — ack-письмо brain в `mailbox/to-brain/`.

## Контекст

- **Стек зафиксирован** (kickoff §2): PWA на React/Next + Payload + Postgres; пуш platform-split best-effort, корректность на in-app очереди «непринятых».
- **Mailbox:** входящие читать из `../brain_matrica/mailboxes/trener/from-brain/`; писать в свой `mailbox/to-brain/`. Первое входящее письмо brain — welcome+kickoff.
- **Решения владельца (06-24):** PWA-first (не RN сейчас); чат — fast-follow M4 (в MVP суррогат «вопрос тренеру»); тренеры правят свои группы.
