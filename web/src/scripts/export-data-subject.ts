/**
 * Техническая выгрузка по запросу школы-оператора.
 * Запуск: SUBJECT_EMAIL=parent@example.ru pnpm payload run ./src/scripts/export-data-subject.ts
 * Печатает JSON в stdout; файл и канал передачи выбирает ответственный сотрудник.
 */
import { getPayload } from 'payload'

import config from '../payload.config'

const email = process.env.SUBJECT_EMAIL?.trim().toLowerCase()
if (!email) throw new Error('SUBJECT_EMAIL обязателен')

const payload = await getPayload({ config })
const users = await payload.find({
  collection: 'users',
  where: { email: { equals: email } },
  limit: 1,
  depth: 0,
  pagination: false,
  overrideAccess: true,
})
const user = users.docs[0]
if (!user) throw new Error(`Пользователь ${email} не найден`)

const players = await payload.find({
  collection: 'players',
  where: { parent: { equals: user.id } },
  limit: 1000,
  depth: 0,
  pagination: false,
  overrideAccess: true,
})
const playerIds = players.docs.map((item) => item.id)

const find = (collection: string, where: Record<string, unknown>) =>
  payload.find({
    collection: collection as never,
    where: where as never,
    limit: 10000,
    depth: 0,
    pagination: false,
    overrideAccess: true,
  })

// Догнано до текущей модели (09.08): платёжные диалоги, чаты, комментарии к матчам,
// реплики «вопроса тренеру», детские заявки, юридический журнал подписей.
const [paymentThreads, paymentMessages, chatMessages, chatReads, matchComments, questionMessages, childRegistrations, legalSignatures] =
  await Promise.all([
    find('payment-threads', { parent: { equals: user.id } }),
    find('payment-messages', { author: { equals: user.id } }),
    find('chat-messages', { author: { equals: user.id } }),
    find('chat-reads', { user: { equals: user.id } }),
    find('match-comments', { author: { equals: user.id } }),
    find('question-messages', { author: { equals: user.id } }),
    find('child-registrations', { account: { equals: user.id } }),
    find('legal-signatures', { signer: { equals: user.id } }),
  ])

const [consents, notifications, rsvps, questions, devices, subscriptions] = await Promise.all([
  payload.find({
    collection: 'consents',
    where: { parent: { equals: user.id } },
    limit: 10000,
    depth: 0,
    pagination: false,
    overrideAccess: true,
  }),
  payload.find({
    collection: 'notifications',
    where: { parent: { equals: user.id } },
    limit: 10000,
    depth: 0,
    pagination: false,
    overrideAccess: true,
  }),
  payload.find({
    collection: 'rsvps',
    where: { parent: { equals: user.id } },
    limit: 10000,
    depth: 0,
    pagination: false,
    overrideAccess: true,
  }),
  payload.find({
    collection: 'questions',
    where: { parent: { equals: user.id } },
    limit: 10000,
    depth: 0,
    pagination: false,
    overrideAccess: true,
  }),
  payload.find({
    collection: 'devices',
    where: { user: { equals: user.id } },
    limit: 10000,
    depth: 0,
    pagination: false,
    overrideAccess: true,
  }),
  playerIds.length
    ? payload.find({
        collection: 'subscriptions',
        where: { player: { in: playerIds } },
        limit: 10000,
        depth: 0,
        pagination: false,
        overrideAccess: true,
      })
    : Promise.resolve({ docs: [] }),
])

process.stdout.write(
  `${JSON.stringify(
    {
      exportedAt: new Date().toISOString(),
      user,
      players: players.docs,
      consents: consents.docs,
      notifications: notifications.docs,
      rsvps: rsvps.docs,
      questions: questions.docs,
      devices: devices.docs,
      subscriptions: subscriptions.docs,
      paymentThreads: paymentThreads.docs,
      paymentMessages: paymentMessages.docs,
      chatMessages: chatMessages.docs,
      chatReads: chatReads.docs,
      matchComments: matchComments.docs,
      questionMessages: questionMessages.docs,
      childRegistrations: childRegistrations.docs,
      legalSignatures: legalSignatures.docs,
    },
    null,
    2,
  )}\n`,
)
