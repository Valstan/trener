# M3 «Первый прод» — дизайн-документ и нарезка на PR

> Блюпринт вехи M3 (kickoff §8). Источник истины по требованиям —
> [`../../brain_matrica/docs/plans/trener-kickoff.md`](../../brain_matrica/docs/plans/trener-kickoff.md) §3/§4/§6/§7/§8.
> Продолжает [`m2-core-design.md`](m2-core-design.md): ядро (изменение→ack→coverage+RSVP) сдано,
> M3 достраивает до **lovable MVP в проде**. Этот файл — план реализации, по нему пишутся PR10+.

## Что входит в M3 (kickoff §8)

> «**M3 — объявления + «вопрос тренеру» + деплой = ПЕРВЫЙ ПРОД lovable MVP.** Announcements
> с пушем + granularity-правило; контекстная кнопка «вопрос тренеру»; деплой
> (systemd+nginx+CI standalone — G20/G17), content/push-smoke (#011).»

Три нитки, две из них — код (делаются с rmz4val), третья — инфра (нужен Бокс 1 + решения владельца):

| Нитка | Что | Где делается |
|---|---|---|
| **A. Объявления** | Coach → группа: новость с опц. best-effort пушем | код (rmz4val) |
| **B. «Вопрос тренеру»** | Контекстная кнопка: родитель → тренеру одно сообщение (суррогат чата) | код (rmz4val) |
| **C. Деплой = первый прод** | Провижен Бокс 1, миграции, CI-standalone, nginx/TLS, deploy-smoke, 152-ФЗ go-live | инфра (Бокс 1 + владелец) |

---

## Принцип M3 (наследует M2)

- **Ров неприкосновенен.** Coverage «N из M» — про **изменения расписания**, и только. Объявления и
  вопросы — table-stakes (kickoff §1), они **НЕ попадают в ack-очередь** и **НЕ разбавляют coverage**.
  Иначе «приняли N из M» перестанет значить «заметили перенос».
- **Granularity-правило жёсткое (kickoff §6): «уведомление, которое родителю не было нужно = баг».**
  Изменения расписания — `high`-priority пуш (M2). Объявления — пуш **только** по явному флагу тренера,
  `normal`-urgency. Вопрос тренеру — реальное событие (родитель написал) → пуш тренеру оправдан.
- **Пуш best-effort** поверх in-app (M2-инфра `lib/push/send`). Корректность объявления = его наличие в
  ленте при заходе; пуш — ускоритель.
- **In-app раньше пуша** — как в M2: каждая фича сначала работает без пуша, пуш вшивается следом/в той же PR
  (для объявлений correctness-доказывать нечего — ack нет, поэтому пуш можно не выносить в отдельную PR).

---

## Модель данных (новое в M3)

### A. Announcements (`announcements`) — НОВАЯ коллекция (kickoff §4)
Информационная новость тренера группе. **Без per-recipient ack-строк** — это лента, не очередь.

| Поле | Тип | Заметка |
|---|---|---|
| `author` | relationship→users | тренер-автор; server-set из сессии, не из клиента |
| `group` | relationship→groups | аудитория. Родитель видит объявления групп СВОИХ детей |
| `title` | text (required) | заголовок |
| `body` | textarea (required) | текст (152-ФЗ: без ПДн детей в массовой рассылке) |
| `triggersPush` | checkbox (default false) | «уведомить пушем» (kickoff §4 «флаг триггерит пуш»). `normal`-urgency |
| `publishedAt` | date (index) | сортировка ленты + «новое с прошлого захода» |

- **Access (#015):** `create`/`update` — тренер своей группы (`author==user` + группа в его группах) или admin;
  `read` — scoped: родитель → `{group:{in: группы его детей}}`, тренер → свои группы, admin → все; `delete` — admin/автор.
- **Доставка:** при `triggersPush=true` — best-effort `normal`-пуш родителям группы через `sendPushToUser`
  (как фан-аут M2, но БЕЗ создания Notifications). Payload пуша — неидентифицирующий (R4): заголовок-приглашение
  + `data.url=/parent` (имя ребёнка/текст не уходят).
- **«Новое»-индикатор (MVP):** лента сортирована по `publishedAt`; «новое» — клиентский маркер по
  last-seen в `localStorage` (без серверной per-user строки). Серверный last-seen — за рамками MVP.

### B. Questions (`questions`) — НОВАЯ коллекция, суррогат чата (kickoff §4/§8)
Одно сообщение родитель → тренеру, привязанное к сессии/объявлению. **БЕЗ домена Threads/Messages** (это M4).

| Поле | Тип | Заметка |
|---|---|---|
| `parent` | relationship→users | автор (от кого); server-set |
| `coach` | relationship→users | адресат-тренер; выводится из группы контекста (НЕ из клиента) |
| `group` | relationship→groups | контекст: группа |
| `session` | relationship→training-sessions (опц.) | если вопрос «по этой тренировке» |
| `body` | textarea (required) | текст вопроса |
| `status` | select: `new`→`read`→`answered` | собственный статус (паттерн M2-инфры) |
| `readAt`/`answeredAt` | date | диагностика |

- **Направление обратное M2:** адресат — ТРЕНЕР (не родитель). Поэтому **отдельная лёгкая коллекция**, а не
  поле в `Notifications` (та жёстко parent-addressed: `parent` required + `filterOptions roles:parent`,
  `session`/`players`/`changedAt` required под волны расписания). «Переиспользует ack-инфру» (kickoff) трактуем как
  **паттерн** (in-app очередь + свой статус), не как ту же таблицу. Осознанное отклонение — как `/parent/*` vs `/api/*` в M2.
  Эволюция в M4: `Questions` → `Threads/Messages` миграцией (один вопрос = первое сообщение нитки).
- **MVP — односторонне:** родитель спрашивает → тренер видит в инбоксе (имя ребёнка + контакт родителя, он уже
  есть у тренера) → отвечает оффлайн/звонком, ставит `answered`. Двусторонняя переписка = M4.
- **Access (#015):** `create` — server-only через эндпоинт (родитель, владение группой через ребёнка проверяет
  эндпоинт); `read` — родитель свои (`parent==user`), тренер свои (`coach==user`), admin все; `update`/`delete` —
  server-only/admin (статус двигает эндпоинт тренера).
- **Эндпоинты:** `POST /parent/question` (создать), `POST /coach/question/[id]/status` (read/answered). Пуш тренеру — best-effort.

### Что НЕ трогаем
`Notifications`/`Rsvps`/`Devices`/`TrainingSessions` — без изменений модели. Объявления и вопросы — аддитивны.

---

## Нарезка на PR (каждый зелёный, верифицируется на dev-БД)

| PR | Что | Граница | Размер |
|---|---|---|---|
| **PR10** | **Объявления end-to-end:** коллекция `Announcements` + access + типы; UI тренера «дать объявление» (`/coach/announcements` или блок на `/coach/schedule`); лента на `/parent`; best-effort `normal`-пуш по `triggersPush` | granularity: пуш только по флагу | M |
| **PR11** | **«Вопрос тренеру» end-to-end:** коллекция `Questions` + access + типы; контекстная кнопка на `/parent` (карточка сессии) → `POST /parent/question`; инбокс тренера `/coach/questions` + `POST /coach/question/[id]/status`; best-effort пуш тренеру | односторонне (полный чат — M4) | M |
| **PR12** | **Prod-миграции (#017):** перевод dev `push:true` → коммиченные Payload-миграции; baseline текущей схемы + announcements/questions; **C4-хвосты M2** — partial-unique `(session,player)` на Rsvps + dedup `(session,parent,changedAt)` на фан-ауте | гейт прод-готовности | M |
| **C. Деплой** | CI-standalone workflow + `trener.service` + nginx + TLS certbot + deploy-smoke (#011); 152-ФЗ go-live (`operator.ts` финал + РКН) | нужен Бокс 1 + владелец | L |

## Ключевые решения (форки M3)

- **F1 — объявления вне coverage.** Не создают Notifications, не влияют на «N из M». Лента + опц. `normal`-пуш. (Ров = только изменения расписания.)
- **F2 — `Questions` отдельной коллекцией**, не полем в Notifications (направление обратное, addressee — тренер). Эволюция в Threads/Messages на M4.
- **F3 — вопрос односторонний** в MVP (родитель→тренер + статус); двусторонняя переписка = M4-чат. Тренер отвечает по уже имеющемуся контакту родителя.
- **F4 — пуш объявления `normal`, изменения `high`** (granularity §6). `triggersPush` — явный жест тренера, не дефолт.
- **F5 — миграции (#017) — прод-гейт.** Прод НЕ на `push:true`. PR12 фиксирует схему миграциями + добивает C4-индексы M2.
- **F6 — «новое»-индикатор объявлений — клиентский** (localStorage last-seen) в MVP; серверный per-user read-state — позже (не нужен для ценности).

## Развилки (на решение владельца — нитка C, деплой)
- **Бокс 1:** какой VPS/хостинг (РФ, 152-ФЗ ст.18 ч.5), домен, порт (предв. 3007 — свериться на боксе).
- **152-ФЗ go-live (вне репо):** РКН-уведомление до go-live; реальные реквизиты оператора в `web/src/lib/operator.ts` + `OPERATOR_FINALIZED=true` (уберёт черновик-плашку с `/privacy`); incident-playbook (§5.7).
- **SMTP-relay для magic-link в проде** (Resend/Brevo/…) — `/etc/trener/trener.env` (#008).

## Образцы для копирования (свои файлы)
- **Фан-аут/пуш:** `web/src/hooks/fanOutScheduleChange.ts` (best-effort пуш-петля, try/catch, overrideAccess) — образец рассылки объявления.
- **Эндпоинт-мутация:** `web/src/app/(frontend)/parent/rsvp/route.ts` (auth → валидация → владение → upsert; server-mediated) — образец `POST /parent/question` и статус-эндпоинта тренера.
- **Scoped-read коллекции:** `web/src/collections/Notifications.ts` (`readNotifications` — плоский `{in: ids}` по группам/сессиям, G90-safe) — образец access для Announcements/Questions.
- **Родительская страница:** `web/src/app/(frontend)/parent/page.tsx` (server-fetch + scoped read + дотяжка деталей overrideAccess) — куда вешать ленту объявлений + кнопку «вопрос».
- **Coach-поверхности:** `web/src/app/(frontend)/coach/schedule/page.tsx`, `coach/session/[id]/page.tsx` — куда вешать «дать объявление» + инбокс вопросов.
- **Деплой 1:1:** `../SabantuyMalmyzh/` / Малмыж/KARMAN — `trener.service`, nginx, CI-standalone (G17/G20), `/etc/trener/trener.env` (#008), deploy-smoke (#011).

## Кандидаты в brain (pool #009) — по факту
- Подтверждение паттерна «суррогат чата отдельной лёгкой коллекцией со своим статусом, мигрирующей в Threads/Messages» — если ляжет чисто, после PR11.
- 152-ФЗ-разделение каналов: «массовая рассылка (объявление) — без ПДн в payload; адресный вопрос — ПДн только в РФ-БД, не в пуше» — после PR10/11.
