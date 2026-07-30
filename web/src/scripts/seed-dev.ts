/**
 * Сид демо-данных для DEV (НЕ для прода).
 *
 * Назначение: наполнить пустую dev-БД реалистичными данными, чтобы вживую «пощупать»
 * фронт (parent/coach экраны, coverage «N из M», объявления, вопросы) без ручного
 * заполнения через админку. Создаёт тренера, родителей, две группы, детей, расписание
 * и — главное — проводит реальные «волны» изменения/отмены тренировки через Local API,
 * чтобы хуки сами разослали уведомления (fanOutScheduleChange) и появились очередь
 * непринятых у родителя + coverage у тренера.
 *
 * Запуск (rmz4val):  corepack pnpm -C web seed
 *           прямо:   ./node_modules/.bin/payload run ./src/scripts/seed-dev.ts
 *
 * Идемпотентность: пользователи/группы/дети/согласия — find-or-create по натуральному
 * ключу; расписание/объявления/вопросы создаются ТОЛЬКО если их ещё нет (повторный
 * прогон не плодит дубликаты и не запускает повторные волны). Ссылки входа (magic-link)
 * перевыпускаются на КАЖДОМ прогоне — они живут 30 минут.
 *
 * Импорты — относительные (граф загрузки конфига чист от алиаса `@/`), чтобы не
 * зависеть от резолва tsconfig-путей в `payload run`.
 */
import { getPayload } from 'payload'

import config from '../payload.config'
import { createLoginToken } from '../lib/auth/magicLink'
import { CONSENT_POLICY_VERSION } from '../lib/consent'

// ─── Предохранитель: только dev-БД ───────────────────────────────────────────
// Прод-БД называется `trener`; dev — `trener_dev`. Требуем подстроку и запрещаем
// production, чтобы случайно не засеять боевую базу демо-данными.
const dbUrl = process.env.DATABASE_URL || ''
if (process.env.NODE_ENV === 'production' || !dbUrl.includes('trener_dev')) {
  console.error(
    `\n[seed-dev] ОТКАЗ: скрипт только для dev-БД (ожидается 'trener_dev' в DATABASE_URL).` +
      `\n  NODE_ENV=${process.env.NODE_ENV ?? '(не задан)'}` +
      `\n  DATABASE_URL=${dbUrl || '(пусто)'}\n`,
  )
  process.exit(1)
}

const payload = await getPayload({ config })
const log = (m: string): void => payload.logger.info(`[seed] ${m}`)

// Дата относительно «сейчас»: at(дней_от_сегодня, час, минута) → ISO.
const now = new Date()
const at = (days: number, hour: number, min = 0): string => {
  const d = new Date(now)
  d.setDate(d.getDate() + days)
  d.setHours(hour, min, 0, 0)
  return d.toISOString()
}
const iso = (): string => new Date().toISOString()

// Пароль ставим только чтобы удовлетворить create auth-коллекции; вход — magic-link.
// Для /admin координатора им же можно войти email+паролем (fallback).
const DEV_PASSWORD = 'devpass1234'

type Role = 'owner' | 'admin' | 'coach' | 'parent'

// ─── Филиалы (M5) ────────────────────────────────────────────────────────────
// ДВА филиала, а не один: с единственным филиалом переключателю владельца нечего
// переключать, и флагман M5 на стенде не виден (аудит 30.07, п.14). Реквизиты
// оплаты заполняем сразу — иначе экран «Оплата» родителя показывает «уточните у
// тренера» и помощник оплаты выглядит недоделанным.
const PAYMENT_DETAILS: Record<string, string> = {
  Малмыж: [
    'Перевод по номеру телефона +7 999 100-20-30 (Сбербанк, Иван П.).',
    'В сообщении к переводу укажите имя ребёнка и месяц: «Артём Смирнов, август».',
    'Абонемент на месяц — 2 500 ₽, разовое занятие — 400 ₽.',
  ].join('\n'),
  'Вятские Поляны': [
    'Перевод по номеру телефона +7 999 400-50-60 (Т-Банк, Сергей Л.).',
    'В сообщении укажите имя ребёнка и месяц.',
    'Абонемент на месяц — 2 200 ₽, разовое занятие — 350 ₽.',
  ].join('\n'),
}

const findOrCreateBranch = async (name: string, city: string) => {
  const paymentDetails = PAYMENT_DETAILS[name]
  const found = await payload.find({
    collection: 'branches',
    where: { name: { equals: name } },
    limit: 1,
    overrideAccess: true,
  })
  if (found.docs[0]) {
    // Бэкфилл реквизитов на уже засеянной БД: прогон сида не должен оставлять
    // «Оплату» пустой только потому, что филиал завели раньше.
    if (!found.docs[0].paymentDetails && paymentDetails) {
      const filled = await payload.update({
        collection: 'branches',
        id: found.docs[0].id,
        data: { paymentDetails },
        overrideAccess: true,
      })
      log(`branch ✔ ${name} (реквизиты дозаполнены)`)
      return filled
    }
    log(`branch ✔ ${name}`)
    return found.docs[0]
  }
  const b = await payload.create({
    collection: 'branches',
    data: { name, city, active: true, paymentDetails },
    overrideAccess: true,
  })
  log(`branch + ${name}`)
  return b
}
const branch = await findOrCreateBranch('Малмыж', 'Малмыж')
const branch2 = await findOrCreateBranch('Вятские Поляны', 'Вятские Поляны')

const findOrCreateUser = async (
  email: string,
  name: string,
  roles: Role[],
  phone?: string,
  userBranchId: number = branch.id,
) => {
  const e = email.toLowerCase()
  const found = await payload.find({
    collection: 'users',
    where: { email: { equals: e } },
    limit: 1,
    overrideAccess: true,
  })
  if (found.docs[0]) {
    log(`user ✔ ${e}`)
    return found.docs[0]
  }
  const u = await payload.create({
    collection: 'users',
    // Владелец сети — без филиала (видит все); остальные живут в demo-филиале.
    data: {
      email: e,
      name,
      roles,
      phone,
      password: DEV_PASSWORD,
      branch: roles.includes('owner') ? undefined : userBranchId,
      status: 'approved',
    },
    overrideAccess: true,
  })
  log(`user + ${e} (${roles.join(',')})`)
  return u
}

// Первым создаём владельца: на пустой БД хук ensureFirstUserAdmin повышает первого
// пользователя до owner — пусть это будет именно owner-аккаунт.
const admin = await findOrCreateUser('admin@trener.local', 'Владелец школы', ['owner'])
const coach = await findOrCreateUser('coach@trener.local', 'Иван Петров', ['coach'], '+7 999 100-20-30')
const p1 = await findOrCreateUser('parent1@trener.local', 'Ольга Смирнова', ['parent'], '+7 999 111-11-11')
const p2 = await findOrCreateUser('parent2@trener.local', 'Дмитрий Кузнецов', ['parent'], '+7 999 222-22-22')
const p3 = await findOrCreateUser('parent3@trener.local', 'Елена Васильева', ['parent'], '+7 999 333-33-33')
// Второй филиал: свой тренер и свой родитель — переключатель владельца показывает
// РАЗНЫЕ данные, а не пустой экран.
const coach2 = await findOrCreateUser(
  'coach2@trener.local',
  'Сергей Лебедев',
  ['coach'],
  '+7 999 400-50-60',
  branch2.id,
)
const p4 = await findOrCreateUser(
  'parent4@trener.local',
  'Марина Орлова',
  ['parent'],
  '+7 999 444-44-44',
  branch2.id,
)

// ─── Группы ──────────────────────────────────────────────────────────────────
const findOrCreateGroup = async (
  name: string,
  description: string,
  groupCoachId: number = coach.id,
  groupBranchId: number = branch.id,
) => {
  const found = await payload.find({
    collection: 'groups',
    where: { name: { equals: name } },
    limit: 1,
    overrideAccess: true,
  })
  if (found.docs[0]) {
    log(`group ✔ ${name}`)
    return found.docs[0]
  }
  const g = await payload.create({
    collection: 'groups',
    data: { name, description, coaches: [groupCoachId], branch: groupBranchId },
    overrideAccess: true,
  })
  log(`group + ${name}`)
  return g
}
const gSenior = await findOrCreateGroup('Старшая группа (2014)', 'Дети 2014 г.р. Тренировки на стадионе «Юность».')
const gJunior = await findOrCreateGroup('Младшая группа (2017)', 'Дети 2017 г.р. Тренировки в спортзале.')
const gPolyany = await findOrCreateGroup(
  'Вятские Поляны (2015)',
  'Дети 2015 г.р. Тренировки в ФОК «Электрон».',
  coach2.id,
  branch2.id,
)

// ─── Дети ────────────────────────────────────────────────────────────────────
const findOrCreatePlayer = async (name: string, groupId: number, parentId: number | null) => {
  const found = await payload.find({
    collection: 'players',
    where: { and: [{ name: { equals: name } }, { group: { equals: groupId } }] },
    limit: 1,
    overrideAccess: true,
  })
  if (found.docs[0]) {
    log(`player ✔ ${name}`)
    return found.docs[0]
  }
  const pl = await payload.create({
    collection: 'players',
    data: { name, group: groupId, parent: parentId ?? undefined },
    overrideAccess: true,
  })
  log(`player + ${name}`)
  return pl
}
// Ольга — двое детей в старшей (акает один раз). Дмитрий — по ребёнку в каждой группе.
const plArtem = await findOrCreatePlayer('Артём Смирнов', gSenior.id, p1.id)
const plMaria = await findOrCreatePlayer('Мария Смирнова', gSenior.id, p1.id)
const plNikita = await findOrCreatePlayer('Никита Кузнецов', gSenior.id, p2.id)
const plSofia = await findOrCreatePlayer('София Васильева', gJunior.id, p3.id)
const plLev = await findOrCreatePlayer('Лев Кузнецов', gJunior.id, p2.id)
// Ребёнок без привязанного родителя — видно в coverage как «некому слать».
await findOrCreatePlayer('Дарья Иванова', gJunior.id, null)
// Второй филиал.
const plKirill = await findOrCreatePlayer('Кирилл Орлов', gPolyany.id, p4.id)
const plVera = await findOrCreatePlayer('Вера Орлова', gPolyany.id, p4.id)

// ─── Согласия (152-ФЗ) ─────────────────────────────────────────────────────────
const ensureConsent = async (parentId: number, playerIds: number[]): Promise<void> => {
  const found = await payload.find({
    collection: 'consents',
    where: { parent: { equals: parentId } },
    limit: 1,
    overrideAccess: true,
  })
  if (found.docs[0]) {
    log(`consent ✔ parent ${parentId}`)
    return
  }
  await payload.create({
    collection: 'consents',
    data: {
      parent: parentId,
      players: playerIds,
      consentGiven: true,
      confirmedRepresentative: true,
      policyVersion: CONSENT_POLICY_VERSION,
    },
    overrideAccess: true,
  })
  log(`consent + parent ${parentId}`)
}
await ensureConsent(p1.id, [plArtem.id, plMaria.id])
await ensureConsent(p2.id, [plNikita.id, plLev.id])
await ensureConsent(p3.id, [plSofia.id])
await ensureConsent(p4.id, [plKirill.id, plVera.id])

// ─── Абонементы (M8) ───────────────────────────────────────────────────────────
// Все четыре состояния экрана «Оплата» на одном стенде: оплачен / заканчивается /
// просрочен / нет записи. Без них раздел, который продаётся как ответ «сколько
// платить и куда», на демо пуст у каждого ребёнка (аудит 30.07, п.3).
const existingSubs = await payload.find({ collection: 'subscriptions', limit: 1, overrideAccess: true })
if (existingSubs.totalDocs === 0) {
  const sub = async (playerId: number, fromDays: number, untilDays: number, amount: number): Promise<void> => {
    await payload.create({
      collection: 'subscriptions',
      data: { player: playerId, paidFrom: at(fromDays, 12), paidUntil: at(untilDays, 12), amount },
      overrideAccess: true,
    })
  }
  await sub(plArtem.id, -10, 20, 2500) // оплачен
  await sub(plMaria.id, -10, 20, 2500) // оплачен
  await sub(plNikita.id, -25, 3, 2500) // заканчивается (порог 7 дней)
  await sub(plLev.id, -40, -5, 2500) // просрочен
  await sub(plKirill.id, -5, 25, 2200) // оплачен (второй филиал)
  // София и Вера — намеренно без записи: «Нет записи» тоже надо показать.
  // Продление = НОВАЯ запись (журнал): у Артёма их две, экран берёт max(paidUntil).
  await sub(plArtem.id, -40, -10, 2500)
  log('subscriptions + созданы (6 шт.: оплачен / заканчивается / просрочен / журнал продления)')
} else {
  log('subscriptions ✔ (уже есть) — пропуск')
}

// ─── Расписание + волны изменения (ТОЛЬКО на пустом расписании) ────────────────
// Создаём planned-сессии, затем РЕАЛЬНО правим одну (перенос → волна 'changed') и
// отменяем другую (волна 'cancelled') через Local API — хуки сами создадут
// уведомления родителям. Это и наполняет очередь родителя + coverage тренера.
const existingSessions = await payload.find({ collection: 'training-sessions', limit: 1, overrideAccess: true })
if (existingSessions.totalDocs === 0) {
  const s1 = await payload.create({
    collection: 'training-sessions',
    data: { group: gSenior.id, startDate: at(1, 18, 0), endDate: at(1, 19, 30), location: 'Стадион «Юность», поле 1', status: 'planned' },
    overrideAccess: true,
  })
  await payload.create({
    collection: 'training-sessions',
    data: { group: gSenior.id, startDate: at(3, 18, 0), endDate: at(3, 19, 30), location: 'Стадион «Юность», поле 1', status: 'planned' },
    overrideAccess: true,
  })
  const s3 = await payload.create({
    collection: 'training-sessions',
    data: { group: gSenior.id, startDate: at(5, 18, 0), endDate: at(5, 19, 30), location: 'Стадион «Юность», поле 2', status: 'planned' },
    overrideAccess: true,
  })
  await payload.create({
    collection: 'training-sessions',
    data: { group: gJunior.id, startDate: at(2, 17, 0), endDate: at(2, 18, 0), location: 'Спортзал школы №3', status: 'planned' },
    overrideAccess: true,
  })
  await payload.create({
    collection: 'training-sessions',
    data: { group: gJunior.id, startDate: at(4, 17, 0), endDate: at(4, 18, 0), location: 'Спортзал школы №3', status: 'planned' },
    overrideAccess: true,
  })
  await payload.create({
    collection: 'training-sessions',
    data: { group: gPolyany.id, startDate: at(2, 17, 30), endDate: at(2, 19, 0), location: 'ФОК «Электрон», зал 2', status: 'planned' },
    overrideAccess: true,
  })
  await payload.create({
    collection: 'training-sessions',
    data: { group: gPolyany.id, startDate: at(4, 17, 30), endDate: at(4, 19, 0), location: 'ФОК «Электрон», зал 2', status: 'planned' },
    overrideAccess: true,
  })
  log('training-sessions + созданы (7 шт., из них 2 во втором филиале)')

  // ВОЛНА 1: перенос s1 на 19:30 → trackSessionChange авто-выставит status=changed и
  // поднимет волну → fanOutScheduleChange разошлёт уведомления родителям старшей.
  await payload.update({
    collection: 'training-sessions',
    id: s1.id,
    data: { startDate: at(1, 19, 30), endDate: at(1, 21, 0) },
    overrideAccess: true,
  })
  log(`волна 'changed' по s1 (перенос 18:00 → 19:30)`)

  // ВОЛНА 2: отмена s3 → волна 'cancelled'.
  await payload.update({
    collection: 'training-sessions',
    id: s3.id,
    data: { status: 'cancelled' },
    overrideAccess: true,
  })
  log(`волна 'cancelled' по s3`)

  // Реалистичный coverage: Ольга (parent1) подтвердила «вижу» по переносу s1 →
  // coverage старшей покажет «приняли 1 из 2» (Дмитрий ещё не принял).
  const notifP1S1 = await payload.find({
    collection: 'notifications',
    where: { and: [{ session: { equals: s1.id } }, { parent: { equals: p1.id } }] },
    limit: 1,
    overrideAccess: true,
  })
  if (notifP1S1.docs[0]) {
    await payload.update({
      collection: 'notifications',
      id: notifP1S1.docs[0].id,
      data: { status: 'acked', ackedAt: iso() },
      overrideAccess: true,
    })
    log('notif acked: Ольга / s1 (coverage → 1 из 2)')
  }

  // RSVP по перенесённой s1: Артём придёт, Мария — нет.
  await payload.create({
    collection: 'rsvps',
    data: { session: s1.id, player: plArtem.id, parent: p1.id, response: 'going', respondedAt: iso() },
    overrideAccess: true,
  })
  await payload.create({
    collection: 'rsvps',
    data: { session: s1.id, player: plMaria.id, parent: p1.id, response: 'not_going', respondedAt: iso() },
    overrideAccess: true,
  })
  log('rsvps + по s1 (going / not_going)')
} else {
  log('training-sessions ✔ (уже есть) — пропуск расписания, волн, coverage, rsvp')
}

// ─── Объявления (ТОЛЬКО если их ещё нет) ───────────────────────────────────────
const existingAnn = await payload.find({ collection: 'announcements', limit: 1, overrideAccess: true })
if (existingAnn.totalDocs === 0) {
  await payload.create({
    collection: 'announcements',
    data: { author: coach.id, scope: 'group' as const, group: gSenior.id, title: 'Форма на следующую неделю', body: 'На тренировки приносим тёмную форму и щитки. Бутсы — по погоде.', triggersPush: false, publishedAt: at(-1, 12, 0) },
    overrideAccess: true,
  })
  await payload.create({
    collection: 'announcements',
    data: { author: coach.id, scope: 'group' as const, group: gSenior.id, title: 'Товарищеский матч в субботу', body: 'В субботу в 11:00 играем со школой «Динамо» на домашнем поле. Приходим за 30 минут до начала.', triggersPush: true, publishedAt: at(0, 9, 0) },
    overrideAccess: true,
  })
  await payload.create({
    collection: 'announcements',
    data: { author: coach.id, scope: 'group' as const, group: gJunior.id, title: 'Командная фотосессия', body: 'В пятницу после тренировки — общая фотография команды. Форма парадная.', triggersPush: false, publishedAt: at(0, 10, 0) },
    overrideAccess: true,
  })
  await payload.create({
    collection: 'announcements',
    data: { author: coach2.id, scope: 'group' as const, group: gPolyany.id, title: 'Открытие сезона в ФОК «Электрон»', body: 'Первая тренировка после каникул — во вторник в 17:30. Форма — синяя.', triggersPush: false, publishedAt: at(-1, 15, 0) },
    overrideAccess: true,
  })
  // Закреплённое общесетевое объявление владельца → баннер на /home. Без него
  // главная-карточки на стенде выглядит так, будто баннера в продукте нет.
  // ⚠️ Гейт охвата живёт в beforeValidate и смотрит на `req.user`, а не на access:
  // с одним overrideAccess он валит create («создаёт только владелец»), поэтому
  // передаём владельца явно через `user` — как это делает реальный серверный путь.
  await payload.create({
    collection: 'announcements',
    data: { author: admin.id, scope: 'network' as const, pinned: true, title: 'Летний турнир сети 15 августа', body: 'Все филиалы едут в Малмыж на общий турнир. Подробности — у тренера группы.', triggersPush: false, publishedAt: at(-2, 11, 0) },
    user: admin,
    overrideAccess: true,
  })
  log('announcements + созданы (5 шт., включая закреплённое общесетевое)')
} else {
  log('announcements ✔ (уже есть) — пропуск')
}

// ─── Вопросы тренеру (ТОЛЬКО если их ещё нет) ──────────────────────────────────
const existingQ = await payload.find({ collection: 'questions', limit: 1, overrideAccess: true })
if (existingQ.totalDocs === 0) {
  await payload.create({
    collection: 'questions',
    data: { parent: p1.id, group: gSenior.id, body: 'Здравствуйте! Будет ли тренировка, если будет сильный дождь?', status: 'new' },
    overrideAccess: true,
  })
  await payload.create({
    collection: 'questions',
    data: { parent: p2.id, group: gSenior.id, body: 'Можно привести Никиту на 10 минут позже? Заберём с продлёнки.', status: 'read', readAt: iso() },
    overrideAccess: true,
  })
  log('questions + созданы (2 шт.)')
} else {
  log('questions ✔ (уже есть) — пропуск')
}

// ─── Свежие ссылки входа (magic-link, 30 мин) ──────────────────────────────────
const base = (process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:3000').replace(/\/+$/, '')
const linkFor = async (email: string): Promise<string> => {
  const raw = await createLoginToken(payload, email)
  return raw ? `${base}/auth/verify?token=${encodeURIComponent(raw)}` : '(не удалось создать токен)'
}
const coachLink = await linkFor('coach@trener.local')
const coach2Link = await linkFor('coach2@trener.local')
const p4Link = await linkFor('parent4@trener.local')
const p1Link = await linkFor('parent1@trener.local')
const p2Link = await linkFor('parent2@trener.local')
const p3Link = await linkFor('parent3@trener.local')
const adminLink = await linkFor('admin@trener.local')

const out: string[] = [
  '',
  '═══════════════════ ВХОД (magic-link, действует 30 минут) ═══════════════════',
  '',
  'ТРЕНЕР — Иван Петров, филиал «Малмыж» (расписание, coverage, объявления, вопросы):',
  `  ${coachLink}`,
  'ТРЕНЕР — Сергей Лебедев, филиал «Вятские Поляны» (второй филиал сети):',
  `  ${coach2Link}`,
  '',
  'РОДИТЕЛЬ — Ольга Смирнова (двое детей в старшей, приняла перенос; абонемент оплачен):',
  `  ${p1Link}`,
  'РОДИТЕЛЬ — Дмитрий Кузнецов (дети в обеих группах, НЕ принял; заканчивается + просрочен):',
  `  ${p2Link}`,
  'РОДИТЕЛЬ — Елена Васильева (дочь в младшей; абонемента нет):',
  `  ${p3Link}`,
  'РОДИТЕЛЬ — Марина Орлова, «Вятские Поляны» (двое детей: оплачен + нет записи):',
  `  ${p4Link}`,
  '',
  'ВЛАДЕЛЕЦ СЕТИ — переключатель филиалов + админка Payload:',
  `  ${adminLink}`,
  `  (или ${base}/admin  →  admin@trener.local  /  ${DEV_PASSWORD})`,
  '',
  '════════════════════════════════════════════════════════════════════════════',
  'Истекли ссылки? Перевыпуск без потери данных:  corepack pnpm -C web seed',
  '',
]
// Печатаем в stdout напрямую (не через logger) — чтобы ссылки было удобно копировать.
console.log(out.join('\n'))

process.exit(0)
