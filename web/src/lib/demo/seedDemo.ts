/**
 * Сид демо-филиала D-029.
 *
 * В отличие от `seed-dev.ts` (DEV-only, реальная БД без сноса) этот сеятель
 * запускается КАЖДУЮ ночь и на проде: он должен снести и пересоздать содержимое
 * ОДНОГО демо-филиала (`isDemo: true`), не трогая живые данные школы. Поэтому
 * предохранитель здесь — не имя БД, а «трогаю только то, что принадлежит
 * демо-филиалу» (все снос/посев — по where-фильтрам от branchId/groupId/userId
 * демо-контура).
 *
 * Демо-юзеры (DEMO_EMAILS) НЕ удаляются между прогонами — find-or-create с
 * стабильными id: активная сессия посетителя, залогиненного вчера, не должна
 * протухать при ночном reseed. Пароль перевыпускается каждый прогон случайным
 * (`crypto.randomUUID()`) и нигде не публикуется — вход только через /demo/login
 * (server-side, overrideAccess), обычный email+пароль для демо-юзеров не работает.
 *
 * Все создания контента — Local API, `overrideAccess: true`, БЕЗ `req.user`:
 * тогда хук `demoGuestLimit` не проставляет `demoGuest: true` (это поле — только
 * для сущностей, которые СОЗДАЁТ посетитель через демо-сессию, лимит 5 не должен
 * бить по собственному сиду).
 *
 * Идемпотентность (#139): двойной прогон подряд должен вернуть одинаковые счётчики
 * (снос полностью очищает предыдущий посев перед новым, users — единственное
 * исключение).
 */
import type { Payload } from 'payload'

import { DEMO_BRANCH_NAME, DEMO_EMAILS } from './constants'
import { CONSENT_POLICY_VERSION } from '../consent'

const DEMO_CITY = 'Приозёрск'
const DEMO_PHONE = '+7 999 000-00-00'

const DEMO_PAYMENT_DETAILS = [
  `Перевод по номеру телефона ${DEMO_PHONE} (демо-реквизиты, деньги никуда не уходят).`,
  'В сообщении к переводу укажите имя ребёнка и месяц.',
  'Абонемент на месяц — 2 000 ₽, разовое занятие — 350 ₽.',
].join('\n')

const DEMO_MONTHLY_FEE = 2000

type Role = 'owner' | 'admin' | 'coach' | 'parent' | 'child'

// Дата относительно «сейчас»: at(дней_от_сегодня, час, минута) → ISO. Такой же
// приём, как в seed-dev.ts — расписание демо всегда «на неделю вперёд от сегодня».
const at = (now: Date, days: number, hour: number, min = 0): string => {
  const d = new Date(now)
  d.setDate(d.getDate() + days)
  d.setHours(hour, min, 0, 0)
  return d.toISOString()
}
const monthsAgo = (now: Date, months: number, day: number, hour = 12): string => {
  const d = new Date(now)
  d.setMonth(d.getMonth() - months, day)
  d.setHours(hour, 0, 0, 0)
  return d.toISOString()
}

export const seedDemo = async (
  payload: Payload,
): Promise<{ branchId: number; counts: Record<string, number> }> => {
  const log = (m: string): void => payload.logger.info(`[seed-demo] ${m}`)
  const now = new Date()
  const iso = (): string => new Date().toISOString()

  // ─── 1. Найти демо-филиал и снести его содержимое (FK-порядок из брифа) ─────
  const existingBranch = await payload.find({
    collection: 'branches',
    where: { isDemo: { equals: true } },
    limit: 1,
    overrideAccess: true,
  })
  const previousBranchId = existingBranch.docs[0]?.id

  if (previousBranchId != null) {
    log(`найден предыдущий демо-филиал #${previousBranchId} — сношу содержимое`)

    const groupsRes = await payload.find({
      collection: 'groups',
      where: { branch: { equals: previousBranchId } },
      limit: 1000,
      pagination: false,
      overrideAccess: true,
    })
    const groupIds = groupsRes.docs.map((g) => g.id)

    const playersRes = groupIds.length
      ? await payload.find({
          collection: 'players',
          where: { group: { in: groupIds } },
          limit: 1000,
          pagination: false,
          overrideAccess: true,
        })
      : { docs: [] }
    const playerIds = playersRes.docs.map((p) => p.id)

    const sessionsRes = groupIds.length
      ? await payload.find({
          collection: 'training-sessions',
          where: { group: { in: groupIds } },
          limit: 1000,
          pagination: false,
          overrideAccess: true,
        })
      : { docs: [] }
    const sessionIds = sessionsRes.docs.map((s) => s.id)

    const matchesRes = groupIds.length
      ? await payload.find({
          collection: 'matches',
          where: { group: { in: groupIds } },
          limit: 1000,
          pagination: false,
          overrideAccess: true,
        })
      : { docs: [] }
    const matchIds = matchesRes.docs.map((m) => m.id)

    const topicsRes = groupIds.length
      ? await payload.find({
          collection: 'chat-topics',
          where: { group: { in: groupIds } },
          limit: 1000,
          pagination: false,
          overrideAccess: true,
        })
      : { docs: [] }
    const topicIds = topicsRes.docs.map((t) => t.id)

    const demoUsersRes = await payload.find({
      collection: 'users',
      where: { email: { in: Object.values(DEMO_EMAILS) } },
      limit: 20,
      pagination: false,
      overrideAccess: true,
    })
    const demoUserIds = demoUsersRes.docs.map((u) => u.id)

    const threadsRes = await payload.find({
      collection: 'payment-threads',
      where: { branch: { equals: previousBranchId } },
      limit: 1000,
      pagination: false,
      overrideAccess: true,
    })
    const threadIds = threadsRes.docs.map((t) => t.id)

    // payment-messages → payment-threads → chat-reads → chat-messages →
    // chat-topics → match-comments → matches → rsvps → notifications →
    // question-messages → questions → announcements → subscriptions →
    // consents (демо-юзеров) → players → training-sessions → groups (филиала).
    if (threadIds.length) {
      await payload.delete({
        collection: 'payment-messages',
        where: { thread: { in: threadIds } },
        overrideAccess: true,
      })
    }
    if (threadIds.length) {
      await payload.delete({
        collection: 'payment-threads',
        where: { id: { in: threadIds } },
        overrideAccess: true,
      })
    }
    if (topicIds.length) {
      await payload.delete({
        collection: 'chat-reads',
        where: { topic: { in: topicIds } },
        overrideAccess: true,
      })
      await payload.delete({
        collection: 'chat-messages',
        where: { topic: { in: topicIds } },
        overrideAccess: true,
      })
      await payload.delete({
        collection: 'chat-topics',
        where: { id: { in: topicIds } },
        overrideAccess: true,
      })
    }
    if (matchIds.length) {
      await payload.delete({
        collection: 'match-comments',
        where: { match: { in: matchIds } },
        overrideAccess: true,
      })
      await payload.delete({
        collection: 'matches',
        where: { id: { in: matchIds } },
        overrideAccess: true,
      })
    }
    if (sessionIds.length) {
      await payload.delete({
        collection: 'rsvps',
        where: { session: { in: sessionIds } },
        overrideAccess: true,
      })
      await payload.delete({
        collection: 'notifications',
        where: { session: { in: sessionIds } },
        overrideAccess: true,
      })
    }
    if (groupIds.length) {
      const questionsRes = await payload.find({
        collection: 'questions',
        where: { group: { in: groupIds } },
        limit: 1000,
        pagination: false,
        overrideAccess: true,
      })
      const questionIds = questionsRes.docs.map((q) => q.id)
      if (questionIds.length) {
        await payload.delete({
          collection: 'question-messages',
          where: { question: { in: questionIds } },
          overrideAccess: true,
        })
        await payload.delete({
          collection: 'questions',
          where: { id: { in: questionIds } },
          overrideAccess: true,
        })
      }
      await payload.delete({
        collection: 'announcements',
        where: { group: { in: groupIds } },
        overrideAccess: true,
      })
    }
    // Общесетевые объявления демо-владельца (scope network, group не задан).
    if (demoUserIds.length) {
      await payload.delete({
        collection: 'announcements',
        where: { author: { in: demoUserIds }, group: { exists: false } },
        overrideAccess: true,
      })
    }
    if (playerIds.length) {
      await payload.delete({
        collection: 'subscriptions',
        where: { player: { in: playerIds } },
        overrideAccess: true,
      })
    }
    if (demoUserIds.length) {
      await payload.delete({
        collection: 'consents',
        where: { parent: { in: demoUserIds } },
        overrideAccess: true,
      })
    }
    if (groupIds.length) {
      await payload.delete({
        collection: 'players',
        where: { group: { in: groupIds } },
        overrideAccess: true,
      })
      await payload.delete({
        collection: 'training-sessions',
        where: { group: { in: groupIds } },
        overrideAccess: true,
      })
      await payload.delete({
        collection: 'groups',
        where: { id: { in: groupIds } },
        overrideAccess: true,
      })
    }
    log('снос демо-содержимого завершён (users demo=true сохранены)')
  }

  // ─── 2. Филиал: find-or-create ─────────────────────────────────────────────
  const foundBranch = await payload.find({
    collection: 'branches',
    where: { isDemo: { equals: true } },
    limit: 1,
    overrideAccess: true,
  })
  const branch =
    foundBranch.docs[0] ??
    (await payload.create({
      collection: 'branches',
      data: {
        name: DEMO_BRANCH_NAME,
        city: DEMO_CITY,
        active: true,
        isDemo: true,
        paymentDetails: DEMO_PAYMENT_DETAILS,
        monthlyFee: DEMO_MONTHLY_FEE,
        operatorName: `Детская футбольная школа «${DEMO_BRANCH_NAME}» (демо)`,
        operatorLegalForm: 'ИП',
        operatorInn: '000000000000',
        operatorAddress: 'Демо-адрес, данные вымышлены',
        operatorEmail: 'privacy@demo.local',
        operatorPhone: DEMO_PHONE,
        operatorResponsiblePerson: 'Демо-ответственный',
      },
      overrideAccess: true,
    }))
  log(`branch: ${branch.name} (#${branch.id})`)

  // ─── 3. Пять демо-юзеров: find-or-create, стабильные id ────────────────────
  const rolesByKey: Record<keyof typeof DEMO_EMAILS, Role[]> = {
    owner: ['owner'],
    admin: ['admin'],
    coach: ['coach'],
    parent: ['parent'],
    child: ['child'],
  }
  const namesByKey: Record<keyof typeof DEMO_EMAILS, string> = {
    owner: 'Демо-владелец',
    admin: 'Демо-администратор',
    coach: 'Демо-тренер',
    parent: 'Демо-родитель',
    child: 'Демо-ребёнок',
  }

  const findOrCreateDemoUser = async (key: keyof typeof DEMO_EMAILS) => {
    const email = DEMO_EMAILS[key]
    const found = await payload.find({
      collection: 'users',
      where: { email: { equals: email } },
      limit: 1,
      overrideAccess: true,
    })
    if (found.docs[0]) {
      log(`user ✔ ${email}`)
      return found.docs[0]
    }
    const u = await payload.create({
      collection: 'users',
      data: {
        email,
        name: namesByKey[key],
        roles: rolesByKey[key],
        demo: true,
        branch: branch.id,
        status: 'approved',
        password: crypto.randomUUID(),
      },
      overrideAccess: true,
    })
    log(`user + ${email}`)
    return u
  }

  const dOwner = await findOrCreateDemoUser('owner')
  const dAdmin = await findOrCreateDemoUser('admin')
  const dCoach = await findOrCreateDemoUser('coach')
  const dParent = await findOrCreateDemoUser('parent')
  const dChild = await findOrCreateDemoUser('child')

  // Фоновые родители — часть содержимого демо-филиала (НЕ из DEMO_EMAILS), нужны
  // для «долг»/«переплата» и для второй реплики в чате, чтобы не отвечать сам себе.
  const findOrCreateBgParent = async (email: string, name: string) => {
    const found = await payload.find({
      collection: 'users',
      where: { email: { equals: email } },
      limit: 1,
      overrideAccess: true,
    })
    if (found.docs[0]) return found.docs[0]
    return payload.create({
      collection: 'users',
      data: {
        email,
        name,
        roles: ['parent'],
        demo: true,
        branch: branch.id,
        status: 'approved',
        password: crypto.randomUUID(),
      },
      overrideAccess: true,
    })
  }
  const bgParent1 = await findOrCreateBgParent('demo-parent2@trener.local', 'Анна Ветрова')
  const bgParent2 = await findOrCreateBgParent('demo-parent3@trener.local', 'Игорь Морозов')

  // ─── 4. Контент ──────────────────────────────────────────────────────────────

  // Группы.
  const g2016 = await payload.create({
    collection: 'groups',
    data: {
      name: 'Звёздочка 2016',
      description: 'Дети 2016 г.р.',
      coaches: [dCoach.id],
      branch: branch.id,
    },
    overrideAccess: true,
  })
  const g2018 = await payload.create({
    collection: 'groups',
    data: {
      name: 'Звёздочка 2018',
      description: 'Дети 2018 г.р.',
      coaches: [dCoach.id],
      branch: branch.id,
    },
    overrideAccess: true,
  })
  log('groups + созданы (2 шт.)')

  // Дети — вымышленные ФИО, намеренно не из окрестностей Малмыжа/Вятских Полян
  // (реквизиты dev-сида). Один — с привязанным аккаунтом демо-ребёнка, у троих —
  // привязан демо-родитель (parent) для полноты экрана «Оплата»/переписки.
  const createPlayer = async (
    name: string,
    groupId: number,
    parentId: number | null,
    accountId: number | null = null,
  ) =>
    payload.create({
      collection: 'players',
      data: {
        name,
        group: groupId,
        branch: branch.id,
        parent: parentId ?? undefined,
        account: accountId ?? undefined,
      },
      overrideAccess: true,
    })

  const plTimur = await createPlayer('Тимур Лунёв', g2016.id, dParent.id, dChild.id)
  const plMark = await createPlayer('Марк Соколов', g2016.id, dParent.id)
  const plEva = await createPlayer('Ева Черникова', g2016.id, dParent.id)
  const plYaroslav = await createPlayer('Ярослав Крылов', g2016.id, bgParent1.id)
  const plPolina = await createPlayer('Полина Гринёва', g2018.id, bgParent1.id)
  const plDanil = await createPlayer('Данил Воронцов', g2018.id, bgParent2.id)
  const plAlisa = await createPlayer('Алиса Журавлёва', g2018.id, bgParent2.id)
  const plFedor = await createPlayer('Фёдор Снегирёв', g2018.id, null)
  log('players + созданы (8 шт.)')

  // Согласия (152-ФЗ) — на детей демо-родителя и фоновых родителей.
  const ensureConsent = async (parentId: number, playerIds: number[]): Promise<void> => {
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
  }
  await ensureConsent(dParent.id, [plTimur.id, plMark.id, plEva.id])
  await ensureConsent(bgParent1.id, [plYaroslav.id, plPolina.id])
  await ensureConsent(bgParent2.id, [plDanil.id, plAlisa.id])
  log('consents + созданы (3 шт.)')

  // ─── Расписание на 7 дней вперёд + одна волна переноса ──────────────────────
  const s1 = await payload.create({
    collection: 'training-sessions',
    data: {
      group: g2016.id,
      startDate: at(now, 1, 18, 0),
      endDate: at(now, 1, 19, 30),
      location: 'Стадион «Приозёрский», поле 1',
      status: 'planned',
    },
    overrideAccess: true,
  })
  await payload.create({
    collection: 'training-sessions',
    data: {
      group: g2016.id,
      startDate: at(now, 3, 18, 0),
      endDate: at(now, 3, 19, 30),
      location: 'Стадион «Приозёрский», поле 1',
      status: 'planned',
    },
    overrideAccess: true,
  })
  await payload.create({
    collection: 'training-sessions',
    data: {
      group: g2016.id,
      startDate: at(now, 5, 18, 0),
      endDate: at(now, 5, 19, 30),
      location: 'Стадион «Приозёрский», поле 1',
      status: 'planned',
    },
    overrideAccess: true,
  })
  await payload.create({
    collection: 'training-sessions',
    data: {
      group: g2018.id,
      startDate: at(now, 2, 17, 0),
      endDate: at(now, 2, 18, 0),
      location: 'Спортзал школы №1',
      status: 'planned',
    },
    overrideAccess: true,
  })
  await payload.create({
    collection: 'training-sessions',
    data: {
      group: g2018.id,
      startDate: at(now, 4, 17, 0),
      endDate: at(now, 4, 18, 0),
      location: 'Спортзал школы №1',
      status: 'planned',
    },
    overrideAccess: true,
  })
  await payload.create({
    collection: 'training-sessions',
    data: {
      group: g2018.id,
      startDate: at(now, 6, 17, 0),
      endDate: at(now, 6, 18, 0),
      location: 'Спортзал школы №1',
      status: 'planned',
    },
    overrideAccess: true,
  })
  await payload.create({
    collection: 'training-sessions',
    data: {
      group: g2016.id,
      startDate: at(now, 7, 18, 0),
      endDate: at(now, 7, 19, 30),
      location: 'Стадион «Приозёрский», поле 1',
      status: 'planned',
    },
    overrideAccess: true,
  })
  log('training-sessions + созданы (7 шт.)')

  // Волна переноса s1 — хук trackSessionChange + fanOutScheduleChange сами
  // выставят status=changed и создадут Notifications родителям группы g2016.
  await payload.update({
    collection: 'training-sessions',
    id: s1.id,
    data: { startDate: at(now, 1, 19, 30), endDate: at(now, 1, 21, 0) },
    overrideAccess: true,
  })
  log(`волна 'changed' по s1 (перенос 18:00 → 19:30)`)

  // ─── Матчи: 2 сыгранных с голами (match-comments) + 1 будущий ───────────────
  const matchPlayed1 = await payload.create({
    collection: 'matches',
    data: {
      group: g2016.id,
      matchDate: at(now, -10, 11, 0),
      opponent: 'ФК «Метеор»',
      homeAway: 'home',
      location: 'Стадион «Приозёрский»',
      scoreOur: 3,
      scoreOpponent: 1,
      scorers: [
        { player: plTimur.id, goals: 2 },
        { player: plMark.id, goals: 1 },
      ],
    },
    overrideAccess: true,
  })
  const matchPlayed2 = await payload.create({
    collection: 'matches',
    data: {
      group: g2016.id,
      matchDate: at(now, -3, 12, 0),
      opponent: 'ФК «Родник»',
      homeAway: 'away',
      location: 'Стадион соперника',
      scoreOur: 2,
      scoreOpponent: 2,
      scorers: [{ player: plEva.id, goals: 2 }],
    },
    overrideAccess: true,
  })
  await payload.create({
    collection: 'matches',
    data: {
      group: g2018.id,
      matchDate: at(now, 6, 11, 0),
      opponent: 'ФК «Заря»',
      homeAway: 'home',
      location: 'Стадион «Приозёрский»',
    },
    overrideAccess: true,
  })
  log('matches + созданы (3 шт., 2 сыгранных + 1 будущий)')

  const say = async (
    matchId: number,
    groupId: number,
    author: { id: number; name?: string | null; email: string },
    role: 'parent' | 'coach',
    body: string,
  ) =>
    payload.create({
      collection: 'match-comments',
      data: {
        match: matchId,
        group: groupId,
        author: author.id,
        authorName: author.name || author.email,
        authorRole: role,
        body,
      },
      overrideAccess: true,
    })
  await say(matchPlayed1.id, g2016.id, dCoach, 'coach', 'Отличная игра, ребята! Тимур сегодня в ударе.')
  await say(matchPlayed1.id, g2016.id, dParent, 'parent', 'Поздравляем команду! Тимур весь вечер счастливый.')
  await say(matchPlayed2.id, g2016.id, bgParent1, 'parent', 'Ничья на выезде — тоже результат, молодцы!')
  log('match-comments + созданы (3 шт.)')

  // ─── Чат: тема с перепиской ─────────────────────────────────────────────────
  const topic = await payload.create({
    collection: 'chat-topics',
    data: {
      title: 'Сбор на турнир 20 сентября',
      group: g2016.id,
      room: 'adults',
      createdBy: dCoach.id,
    },
    overrideAccess: true,
  })
  const chatMsg = async (
    author: { id: number; name?: string | null; email: string },
    role: 'coach' | 'parent',
    body: string,
    when: string,
  ) =>
    payload.create({
      collection: 'chat-messages',
      data: {
        topic: topic.id,
        group: g2016.id,
        room: 'adults',
        author: author.id,
        authorName: author.name || author.email,
        authorRole: role,
        body,
        createdAt: when,
      },
      overrideAccess: true,
    })
  await chatMsg(dCoach, 'coach', 'Выезжаем в субботу в 8:00 от стадиона. Форма, щитки, вода.', at(now, -1, 9, 0))
  await chatMsg(dParent, 'parent', 'Тимур и Марк едут вместе, привезу обоих к 7:45.', at(now, -1, 9, 20))
  await chatMsg(bgParent1, 'parent', 'А обратно во сколько примерно?', at(now, -1, 10, 0))
  await chatMsg(dCoach, 'coach', 'Ориентировочно к 16:00, напишу здесь перед выездом обратно.', at(now, -1, 10, 15))
  await chatMsg(bgParent2, 'parent', 'Спасибо, ждём!', at(now, -1, 10, 30))
  await payload.update({
    collection: 'chat-topics',
    id: topic.id,
    data: { lastMessageAt: at(now, -1, 10, 30) },
    overrideAccess: true,
  })
  log('chat-topics + создана (1 тема, 5 сообщений)')

  // ─── Подписки/оплаты за 3 месяца назад: оплачено / долг / переплата ────────
  // Демо-parent — оплачено ровно (3 месяца подряд закрыты).
  for (let m = 3; m >= 1; m -= 1) {
    await payload.create({
      collection: 'subscriptions',
      data: {
        player: plTimur.id,
        paidFrom: monthsAgo(now, m, 1),
        paidUntil: monthsAgo(now, m - 1, 1),
        amount: DEMO_MONTHLY_FEE,
      },
      overrideAccess: true,
    })
  }
  // Второй родитель — долг за текущий месяц: оплачено только за 2 месяца назад.
  await payload.create({
    collection: 'subscriptions',
    data: {
      player: plYaroslav.id,
      paidFrom: monthsAgo(now, 3, 1),
      paidUntil: monthsAgo(now, 1, 1),
      amount: DEMO_MONTHLY_FEE,
    },
    overrideAccess: true,
  })
  // Третий родитель — переплата: заплачено на месяц вперёд сверх обычного цикла.
  await payload.create({
    collection: 'subscriptions',
    data: {
      player: plDanil.id,
      paidFrom: monthsAgo(now, 3, 1),
      paidUntil: at(now, 35, 12),
      amount: DEMO_MONTHLY_FEE * 4,
    },
    overrideAccess: true,
  })
  log('subscriptions + созданы (5 шт.: оплачено ровно / долг / переплата)')

  // ─── Payment-thread с сообщениями ────────────────────────────────────────────
  const thread = await payload.create({
    collection: 'payment-threads',
    data: { parent: dParent.id, branch: branch.id, lastMessageAt: iso() },
    overrideAccess: true,
  })
  await payload.create({
    collection: 'payment-messages',
    data: {
      thread: thread.id,
      author: dParent.id,
      authorName: dParent.name || dParent.email,
      authorRole: 'parent',
      body: 'Здравствуйте! Перевела за Тимура сегодня, чек прикладываю на почту.',
    },
    overrideAccess: true,
  })
  await payload.create({
    collection: 'payment-messages',
    data: {
      thread: thread.id,
      author: dOwner.id,
      authorName: dOwner.name || dOwner.email,
      authorRole: 'staff',
      body: 'Спасибо, оплату получили, абонемент продлён.',
    },
    overrideAccess: true,
  })
  log('payment-threads + создан (1 нить, 2 сообщения)')

  // ─── Объявления ──────────────────────────────────────────────────────────────
  await payload.create({
    collection: 'announcements',
    data: {
      author: dCoach.id,
      scope: 'group' as const,
      group: g2016.id,
      title: 'Форма на турнир',
      body: 'На турнир 20 сентября берём тёмную форму и запасную футболку.',
      triggersPush: false,
      publishedAt: at(now, -1, 12, 0),
    },
    overrideAccess: true,
  })
  // Второе объявление — тоже scope='group' (не network/pinned): гейт охвата в
  // Announcements.beforeValidate пускает сетевые/закреплённые только «полного»
  // владельца (isFullOwner = isOwner && !isDemo) — демо-владелец исключён нарочно
  // (D-029/#133: демо не должно уметь того, что живой owner делает по-настоящему).
  await payload.create({
    collection: 'announcements',
    data: {
      author: dCoach.id,
      scope: 'group' as const,
      group: g2018.id,
      title: 'Открытие сезона',
      body: 'Первая тренировка группы 2018 г.р. — в среду в 17:00. Форма — по погоде.',
      triggersPush: false,
      publishedAt: at(now, -2, 10, 0),
    },
    overrideAccess: true,
  })
  log('announcements + созданы (2 шт.)')

  // ─── Вопрос тренеру с ответом ─────────────────────────────────────────────
  const question = await payload.create({
    collection: 'questions',
    data: {
      parent: dParent.id,
      group: g2016.id,
      body: 'Здравствуйте! Можно ли перевести Тимура в старшую группу в следующем сезоне?',
      status: 'answered',
      readAt: iso(),
      answeredAt: iso(),
    },
    overrideAccess: true,
  })
  await payload.create({
    collection: 'question-messages',
    data: {
      question: question.id,
      group: g2016.id,
      parent: dParent.id,
      author: dCoach.id,
      authorRole: 'coach',
      body: 'Здравствуйте! Да, обсудим это на итоговом собрании в конце месяца.',
    },
    overrideAccess: true,
  })
  log('questions + создан (1 вопрос с ответом)')

  // ─── 5. Счётчики (для лога cron и приёмки) ──────────────────────────────────
  const groupIds = [g2016.id, g2018.id]
  const counts: Record<string, number> = {
    branches: 1,
    users: 5 + 2, // 5 демо-ролей + 2 фоновых родителя
    groups: groupIds.length,
    players: 8,
    consents: 3,
    'training-sessions': 7,
    notifications: (
      await payload.count({
        collection: 'notifications',
        where: { session: { in: [s1.id] } },
        overrideAccess: true,
      })
    ).totalDocs,
    matches: 3,
    'match-comments': 3,
    'chat-topics': 1,
    'chat-messages': 5,
    subscriptions: 5,
    'payment-threads': 1,
    'payment-messages': 2,
    announcements: 2,
    questions: 1,
    'question-messages': 1,
  }

  log(`готово: филиал #${branch.id}, счётчики: ${JSON.stringify(counts)}`)
  return { branchId: branch.id, counts }
}
