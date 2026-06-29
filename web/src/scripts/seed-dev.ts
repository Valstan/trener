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

type Role = 'admin' | 'coach' | 'parent'

const findOrCreateUser = async (email: string, name: string, roles: Role[], phone?: string) => {
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
    data: { email: e, name, roles, phone, password: DEV_PASSWORD },
    overrideAccess: true,
  })
  log(`user + ${e} (${roles.join(',')})`)
  return u
}

// Первым создаём админа: на пустой БД хук ensureFirstUserAdmin повышает первого
// пользователя до admin — пусть это будет именно админ-аккаунт.
const admin = await findOrCreateUser('admin@trener.local', 'Администратор школы', ['admin'])
const coach = await findOrCreateUser('coach@trener.local', 'Иван Петров', ['coach'], '+7 999 100-20-30')
const p1 = await findOrCreateUser('parent1@trener.local', 'Ольга Смирнова', ['parent'], '+7 999 111-11-11')
const p2 = await findOrCreateUser('parent2@trener.local', 'Дмитрий Кузнецов', ['parent'], '+7 999 222-22-22')
const p3 = await findOrCreateUser('parent3@trener.local', 'Елена Васильева', ['parent'], '+7 999 333-33-33')
void admin // создан для входа в /admin; в остальном скрипте не используется

// ─── Группы ──────────────────────────────────────────────────────────────────
const findOrCreateGroup = async (name: string, description: string) => {
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
    data: { name, description, coaches: [coach.id] },
    overrideAccess: true,
  })
  log(`group + ${name}`)
  return g
}
const gSenior = await findOrCreateGroup('Старшая группа (2014)', 'Дети 2014 г.р. Тренировки на стадионе «Юность».')
const gJunior = await findOrCreateGroup('Младшая группа (2017)', 'Дети 2017 г.р. Тренировки в спортзале.')

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
  log('training-sessions + созданы (5 шт.)')

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
    data: { author: coach.id, group: gSenior.id, title: 'Форма на следующую неделю', body: 'На тренировки приносим тёмную форму и щитки. Бутсы — по погоде.', triggersPush: false, publishedAt: at(-1, 12, 0) },
    overrideAccess: true,
  })
  await payload.create({
    collection: 'announcements',
    data: { author: coach.id, group: gSenior.id, title: 'Товарищеский матч в субботу', body: 'В субботу в 11:00 играем со школой «Динамо» на домашнем поле. Приходим за 30 минут до начала.', triggersPush: true, publishedAt: at(0, 9, 0) },
    overrideAccess: true,
  })
  await payload.create({
    collection: 'announcements',
    data: { author: coach.id, group: gJunior.id, title: 'Командная фотосессия', body: 'В пятницу после тренировки — общая фотография команды. Форма парадная.', triggersPush: false, publishedAt: at(0, 10, 0) },
    overrideAccess: true,
  })
  log('announcements + созданы (3 шт.)')
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
const p1Link = await linkFor('parent1@trener.local')
const p2Link = await linkFor('parent2@trener.local')
const p3Link = await linkFor('parent3@trener.local')
const adminLink = await linkFor('admin@trener.local')

const out: string[] = [
  '',
  '═══════════════════ ВХОД (magic-link, действует 30 минут) ═══════════════════',
  '',
  'ТРЕНЕР — Иван Петров (расписание, coverage, объявления, вопросы):',
  `  ${coachLink}`,
  '',
  'РОДИТЕЛЬ — Ольга Смирнова (двое детей в старшей, приняла перенос):',
  `  ${p1Link}`,
  'РОДИТЕЛЬ — Дмитрий Кузнецов (дети в обеих группах, НЕ принял):',
  `  ${p2Link}`,
  'РОДИТЕЛЬ — Елена Васильева (дочь в младшей):',
  `  ${p3Link}`,
  '',
  'КООРДИНАТОР — админка Payload:',
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
