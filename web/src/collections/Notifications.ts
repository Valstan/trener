import type { Access, CollectionConfig, Where } from 'payload'

import { adminOnly } from '../access/adminOnly'
import { coachSessionIds, isAdmin, isCoach, isParent } from '../access/roles'

// Уведомление родителю об изменении/отмене тренировки.
//
// ЯДРО КОРРЕКТНОСТИ M2 (kickoff §6/§8): это «in-app очередь непринятых» —
// первичный гарант доведения, НЕ зависящий от доставки пуша. `status` —
// СОБСТВЕННЫЙ статус (delivered→seen→acked), а не read-флаг провайдера: на нём
// строится coverage-экран тренера «приняли N из M».
//
// Гранулярность (критик M2 H4): одно уведомление = на (session × parent) за одну
// «волну» изменения. `players` (hasMany) — какие дети этого родителя в затронутой
// группе (родитель с двумя детьми акает один раз, а не дважды). RSVP «придём ли» —
// отдельная коллекция Rsvps, по (session × player).
//
// Волны (критик M2 C2): `changedAt` — СНИМОК `session.changedAt` на момент создания.
// Повторная правка той же сессии → новая волна (новые delivered-записи), старые
// непринятые помечаются `superseded` фан-аутом (PR5). Coverage считает ТОЛЬКО
// текущую волну (`notification.changedAt == session.changedAt`) — иначе ack старой
// правки засчитался бы за новую, и «N из M» бы врал.
//
// #015 / G90: ВСЕ записи server-mediated. create — фан-аут-хук (PR5, overrideAccess);
// ack — эндпоинт /api/notifications/ack (PR6), который сам проверяет
// `notification.parent == user.id` и двигает статус только вперёд, затем
// overrideAccess-update. Поэтому прямой client-write закрыт (`update: adminOnly`):
// родитель не может PATCH'ем поставить чужой/откатить статус. read — scoped:
// родитель видит свои, тренер — по сессиям своих групп (плоский `{session:{in:…}}`,
// не вложенный relationship-where — критик H2).
const readNotifications: Access = async ({ req }) => {
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

export const Notifications: CollectionConfig = {
  slug: 'notifications',
  labels: {
    singular: 'Уведомление',
    plural: 'Уведомления',
  },
  access: {
    create: () => false, // только фан-аут-хук (PR5, overrideAccess)
    read: readNotifications,
    update: adminOnly, // ack — через эндпоинт (overrideAccess после проверки владения); прямой client-write закрыт
    delete: adminOnly,
  },
  admin: {
    defaultColumns: ['session', 'parent', 'type', 'status', 'changedAt'],
    useAsTitle: 'id',
    description:
      'Очередь «непринятых» + ack. Первичный гарант доведения (не зависит от пуша). Источник coverage «N из M».',
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
      name: 'parent',
      type: 'relationship',
      label: 'Родитель (адресат)',
      relationTo: 'users',
      required: true,
      index: true,
      filterOptions: () => ({ roles: { in: ['parent'] } }),
    },
    {
      name: 'players',
      type: 'relationship',
      label: 'Дети (в затронутой группе)',
      relationTo: 'players',
      hasMany: true,
      required: true,
      admin: {
        description: 'Какие дети этого родителя затронуты. Имена в payload пуша НЕ уходят (152-ФЗ).',
      },
    },
    {
      name: 'type',
      type: 'select',
      label: 'Тип',
      required: true,
      options: [
        { label: 'Изменение', value: 'changed' },
        { label: 'Отмена', value: 'cancelled' },
      ],
    },
    {
      name: 'status',
      type: 'select',
      label: 'Статус',
      required: true,
      defaultValue: 'delivered',
      index: true,
      options: [
        { label: 'Доставлено', value: 'delivered' }, // в очереди, не принято
        { label: 'Просмотрено', value: 'seen' }, // открыл, но не подтвердил
        { label: 'Принято', value: 'acked' }, // тапнул «вижу» → питает coverage
        { label: 'Устарело', value: 'superseded' }, // перекрыто новой волной изменения
      ],
      admin: {
        description: 'delivered→seen→acked. Родитель двигает только вперёд (ack). superseded ставит фан-аут.',
      },
    },
    {
      name: 'changedAt',
      type: 'date',
      label: 'Волна изменения',
      required: true,
      index: true,
      admin: {
        readOnly: true,
        position: 'sidebar',
        description: 'Снимок session.changedAt. Coverage сверяет с текущей волной сессии.',
      },
    },
    {
      name: 'pushSentAt',
      type: 'date',
      label: 'Пуш отправлен',
      admin: { readOnly: true, position: 'sidebar', description: 'Диагностика best-effort. Не корректность.' },
    },
    {
      name: 'pushResult',
      type: 'select',
      label: 'Результат пуша',
      options: [
        { label: 'ok', value: 'ok' },
        { label: 'failed', value: 'failed' },
        { label: 'skipped', value: 'skipped' },
      ],
      admin: { readOnly: true, position: 'sidebar' },
    },
    {
      name: 'seenAt',
      type: 'date',
      label: 'Просмотрено в',
      admin: { readOnly: true, position: 'sidebar' },
    },
    {
      name: 'ackedAt',
      type: 'date',
      label: 'Принято в',
      admin: { readOnly: true, position: 'sidebar' },
    },
  ],
  timestamps: true,
}
