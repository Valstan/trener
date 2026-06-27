import type { Access, CollectionConfig, Where } from 'payload'

import { adminOnly } from '../access/adminOnly'
import { coachSessionIds, isAdmin, isCoach, isParent } from '../access/roles'

// RSVP родителя: «придёт ли ребёнок на тренировку» (going / not_going).
//
// ОТДЕЛЬНО от ack (kickoff §4): ack = «заметил изменение?», RSVP = «придёшь?».
// Привязка по (session × player) — у родителя может быть несколько детей в группе,
// и за каждого ответ свой.
//
// Уникальность (session × player): обеспечивается upsert'ом в эндпоинте /api/rsvp
// (PR9: find existing → update|create), повторный тап меняет ответ, не плодит
// записи. DB-уровневый UNIQUE index на (session, player) (`indexes` ниже, C4) —
// страховка от гонки двух параллельных тапов. Обычный compound-UNIQUE, не partial:
// обе колонки NOT NULL, и Payload-конфиг partial не выражает (поток #017 требует
// верификации схемы 1:1 с dev-push — см. docs/migrations.md).
//
// #015 / G90: write — server-mediated через эндпоинт (PR9), который проверяет
// `player.parent == user.id` (родитель отвечает ТОЛЬКО за своих детей) и пишет
// overrideAccess. Прямой client-write закрыт. read — scoped: родитель свои,
// тренер — по сессиям своих групп (плоский session-in, не вложенный where, H2).
const readRsvps: Access = async ({ req }) => {
  const { user } = req
  if (!user) return false
  if (isAdmin(user)) return true
  if (isCoach(user)) {
    const ids = await coachSessionIds(req, user.id)
    if (!ids.length) return false
    const where: Where = { session: { in: ids } }
    return where
  }
  if (isParent(user)) {
    const where: Where = { parent: { equals: user.id } }
    return where
  }
  return false
}

export const Rsvps: CollectionConfig = {
  slug: 'rsvps',
  labels: {
    singular: 'Ответ об участии',
    plural: 'Ответы об участии',
  },
  // C4: один ответ на (тренировка × ребёнок). Страховка от гонки двух параллельных
  // тапов поверх endpoint-upsert (/api/rsvp). Обе колонки NOT NULL → обычный UNIQUE.
  indexes: [{ fields: ['session', 'player'], unique: true }],
  access: {
    create: () => false, // только эндпоинт /api/rsvp (overrideAccess после проверки player.parent)
    read: readRsvps,
    update: adminOnly, // upsert эндпоинтом (overrideAccess); прямой client-write закрыт
    delete: adminOnly,
  },
  admin: {
    defaultColumns: ['session', 'player', 'parent', 'response'],
    useAsTitle: 'id',
    description: 'Кто придёт на тренировку. Один ответ на (тренировка × ребёнок). Сводка — на coverage-экране.',
  },
  fields: [
    {
      name: 'session',
      type: 'relationship',
      label: 'Тренировка',
      relationTo: 'training-sessions',
      required: true,
      index: true,
    },
    {
      name: 'player',
      type: 'relationship',
      label: 'Ребёнок',
      relationTo: 'players',
      required: true,
      index: true,
    },
    {
      name: 'parent',
      type: 'relationship',
      label: 'Родитель (ответил)',
      relationTo: 'users',
      required: true,
      index: true,
      filterOptions: () => ({ roles: { in: ['parent'] } }),
    },
    {
      name: 'response',
      type: 'select',
      label: 'Ответ',
      required: true,
      options: [
        { label: 'Придём', value: 'going' },
        { label: 'Не придём', value: 'not_going' },
      ],
    },
    {
      name: 'respondedAt',
      type: 'date',
      label: 'Ответ дан в',
      admin: { readOnly: true, position: 'sidebar', description: 'Для cron-напоминания только нереспондентам (PR9).' },
    },
  ],
  timestamps: true,
}
