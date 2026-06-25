# trener — Session Handoff

> Sticky-note для непрерывности сессий. Перезаписывается `/close_session`. История через `git log -- docs/SESSION_HANDOFF.md`.

**Status:** ACTIVE
**Updated:** 2026-06-25 (хостинг-блокер снят: brain ответил → площадка выбрана = Бокс 1, ack отправлен; ёмкость перепроверена живым замером)
**Branch:** main

## Текущая нитка

**M1 (каркас + 152-ФЗ floor) — PR3 завершён.** За сессию 2026-06-25 смержено 4 PR:
- **[#11](https://github.com/Valstan/trener/pull/11)** — PWA-каркас: `app/manifest.ts` (корень app/, G12), `public/sw.js`, install-промпт + iOS-подсказка, `/offline`, иконки мяч-на-поле (`src/scripts/genPwaIcons.ts`, sharp).
- **[#12](https://github.com/Valstan/trener/pull/12)** — 152-ФЗ статика: `/privacy` (публичная политика обработки ПДн, ст.18.1), согласие доведено до информированного акта, `lib/operator.ts`.
- **[#13](https://github.com/Valstan/trener/pull/13)** — `docs/incident-playbook.md` (утечка ПДн: 24ч/72ч РКН, §5.7).
- **[#14](https://github.com/Valstan/trener/pull/14)** — письмо brain: вопрос по прод-хостингу + serverless-развилке (`kind=question`).

**152-ФЗ floor по коду закрыт.** Остались операционные шаги go-live (вне репо): уведомление РКН (§5.1), РФ-локализация прод-БД (§5.2), финализация реквизитов оператора.

## Следующий шаг

**M2 (ядро: изменение→пуш→ack→coverage + RSVP).** Хостинг-блокер снят, deploy-smoke — это M3 (дальше по вехам).
**Площадка прода выбрана: Бокс 1** (Гоньба-бокс `831d0ce99bdf.vps.myjino.ru`) — решение владельца 2026-06-25, совпало с рекомендацией brain. Ack отправлен (`mailbox/to-brain/2026-06-25-ack-prod-hosting-box1.md`), brain заархивирует `prod-hosting-answer`.
**deploy-smoke #011 (M3) — первый прод** (там же впервые прогон рантайма auth/invite/consent + живой PWA-цикл; сейчас не прогнаны — нет локального Postgres). Провижен бокса + смоук = M3, до них железо не трогаем.
Когда выйдем на M3 → провижен изоляции на Боксе 1 → deploy-smoke → **финальный ack-письмо brain о готовности всего M1**.
Опционально параллельно: auto-merge workflow (см. Контекст — авто-мерж сейчас ручной).

## Контекст

- **PWA (PR3):** manifest/иконки/sw на публичных путях (G59 — браузер тянет без cookies), manifest в корне `app/` (G12). SW: network-first навигации, cache-first статика; **auth/онбординг (`/auth`,`/login`,`/join`,`/onboarding`) НЕ кэшируются** (152-ФЗ — токены+детские ПДн не оседают в Cache Storage). SW регистрируется только в prod. Иконки перегенерить — `node web/src/scripts/genPwaIcons.ts`.
- **152-ФЗ статика (PR3):** `/privacy` — публичная, без auth, доступна с главной и из формы согласия. Согласие — отдельный акт (оператор/данные/цели/срок + ссылка на политику + право отзыва), чекбокс не предзаполнен. ⚠️ **Перед go-live:** `web/src/lib/operator.ts` — вписать реальные реквизиты + дату уведомления РКН, выставить `OPERATOR_FINALIZED=true` (уберёт черновик-плашку с `/privacy`).
- **⚠️ Авто-мерж — реальность vs мандат:** native GitHub auto-merge в репо **отключён** (`gh pr merge --auto` → «Auto merge is not allowed»), отдельного auto-merge **workflow нет** (только `ci.yml`). «Авто-мерж по зелёному» (#027) де-факто = **сессия мержит зелёный PR вручную** `gh pr merge --squash --delete-branch` (без человеческого ревью — зелёный CI = аппрувер). Чтобы стало hands-off — добавить workflow (`workflow_run` по успеху CI → `gh pr merge --squash`).
- **Каркас `web/`:** Payload 3.75 / Next 15.4 / React 19 / Postgres. Коллекции: Users(admin|coach|parent), Groups, Players, TrainingSessions, Consents, LoginTokens. authz #015 day-1. Сборка standalone в CI (`STANDALONE_BUILD=1`); локальный `next build` — обычный (G17/G20).
- **Решения владельца:** PWA-first (не RN); чат — M4; тренеры правят свои группы; invite-воронка — тренер заводит Player, инвайт линкует родителя.

## Хвосты на потом (не блокеры)

- **✅ Хостинг решён (06-25):** Бокс 1, изоляция per-project. **Провижен на M3** (точь-в-точь вМалмыже/KARMAN): своя БД `trener` + роль `trener_app`, секреты `/etc/trener/trener.env` (#008), `trener.service`, порт предв. **3007** (3002/3004/3005/3006 заняты — свериться на боксе), CI-standalone деплой (G17/G20), TLS certbot. Ёмкость на 06-25: Бокс 1 = 936 МБ available + 2 ГБ swap, 1 vCPU — **вмещает впритык**; триггер на managed-PG: available < ~400 МБ под нагрузкой или 2-я школа.
- **Локальный node_modules:** после pull PR с изменением `web/pnpm-lock.yaml` прогнать `pnpm -C web install` — иначе typecheck падает `Cannot find module` (node_modules отстаёт от lockfile). Также `.next` от смены ветки может оставлять устаревшие типы → `rm -rf web/.next` при ложном TS2307 на `.next/types`.
- **152-ФЗ sequencing:** тренер заводит Player (имя+группа) ДО согласия родителя — уточнить юр-обоснование (ростер школы) в M2.
- **CI дублируется** (push + pull_request → 2 прогона на PR) — можно сузить concurrency/path-filter, не блокер.
- **CI-аннотация:** `pnpm/action-setup@v4` тянет Node20-deprecation warning — не падение.
