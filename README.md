# trener

**Координатор детской футбольной школы.** Тренеры ведут расписание групп и шлют объявления; родители получают уведомления об изменениях и **подтверждают** их; тренер видит, кто заметил («приняли N из M»). Админ управляет структурой (группы/тренеры/дети).

- **Статус:** 🟢 в продакшене — `интер.вмалмыже.рф` (закрытое тестирование на вымышленных данных; юридический go-live каждой школы — отдельным решением, см. [`docs/branch-onboarding-privacy.md`](docs/branch-onboarding-privacy.md)).
- **План, стек, вехи, 152-ФЗ-floor:** [`../brain_matrica/docs/plans/trener-kickoff.md`](../brain_matrica/docs/plans/trener-kickoff.md) — главный стартовый документ.
- **Реестровая карточка:** [`../brain_matrica/projects/trener.md`](../brain_matrica/projects/trener.md).
- **Концепт (история):** [`../brain_matrica/docs/plans/football-school-coordinator-concept.md`](../brain_matrica/docs/plans/football-school-coordinator-concept.md).

## Стек (зафиксирован)

PWA на React/Next + **Payload CMS + PostgreSQL** (бэкенд = стек GONBA/Sabantuy). Пуш — platform-split (iOS APNs web-push / Android FCM HTTP v1 + VAPID), пуш best-effort, корректность на in-app очереди «непринятых». РФ-хостинг (152-ФЗ). Апгрейд-путь при смене парка телефонов — Expo/React Native + RuStore (см. kickoff §2).

## Управление и почта

Проект под управлением meta-репо **`brain_matrica`** (`../brain_matrica/`). Связь — через асимметричные mailbox'ы (ADR-0001 v3). Правила работы AI-сессий и проверка почты — в [`AGENTS.md`](AGENTS.md) (канон; `CLAUDE.md` и аналоги — тонкие адаптеры инструментов).

## Текущее состояние

Вехи M1–M9 построены и в проде: расписание → уведомление → подтверждение родителя → coverage тренеру, RSVP, объявления, «вопрос тренеру», чаты, оплата (учёт, деньги через приложение не ходят). Текущая работа и следующий шаг — в [`docs/SESSION_HANDOFF.md`](docs/SESSION_HANDOFF.md).
