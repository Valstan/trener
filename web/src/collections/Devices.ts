import type { CollectionConfig } from 'payload'

import { adminOnly } from '../access/adminOnly'
import { selfByUser } from '../access/scoped'

// Подписка на web-push (одна запись = один браузер/устройство пользователя).
//
// Назначение: адрес доставки best-effort пуша (kickoff §6). Пуш — ускоритель, НЕ
// гарант корректности (её держат in-app очередь Notifications + coverage-экран).
//
// 152-ФЗ: endpoint и ключи (p256dh/auth) — это адрес и крипто-материал ДОСТАВКИ,
// не ПДн ребёнка. Хранятся в РФ-БД, наружу (Apple/Google) уходит только сам
// непрозрачный endpoint + неидентифицирующий payload (политика §6, kickoff §5.8).
// read/write — строго свой `user`, никакого public-read.
//
// #015: записи создаёт/удаляет ТОЛЬКО сервер (эндпоинты /api/push/subscribe и
// /unsubscribe, PR8) с overrideAccess, проставляя `user` из сессии — поэтому
// прямой create через REST закрыт (`() => false`), как у Notifications. Это не даёт
// подделать `user` чужого аккаунта крафченным запросом.
export const Devices: CollectionConfig = {
  slug: 'devices',
  labels: {
    singular: 'Устройство (push)',
    plural: 'Устройства (push)',
  },
  access: {
    create: () => false, // только сервер через эндпоинт подписки (overrideAccess)
    read: selfByUser, // админ + свои подписки
    update: adminOnly, // lastSuccessAt/failureCount пишет сервис отправки (overrideAccess)
    delete: selfByUser, // отписаться может владелец (и админ)
  },
  admin: {
    defaultColumns: ['user', 'platform', 'lastSuccessAt', 'failureCount'],
    useAsTitle: 'endpoint',
    description: 'Web-push подписки. Адрес доставки best-effort пуша. Доступ — только свой владелец.',
  },
  fields: [
    {
      name: 'user',
      type: 'relationship',
      label: 'Пользователь',
      relationTo: 'users',
      required: true,
      index: true,
    },
    {
      name: 'endpoint',
      type: 'text',
      label: 'Endpoint',
      required: true,
      unique: true, // дедуп повторной подписки того же браузера; адрес отправки
      admin: { readOnly: true },
    },
    {
      name: 'p256dh',
      type: 'text',
      label: 'Ключ p256dh',
      required: true,
      admin: { readOnly: true },
    },
    {
      name: 'auth',
      type: 'text',
      label: 'Ключ auth',
      required: true,
      admin: { readOnly: true },
    },
    {
      name: 'platform',
      type: 'text',
      label: 'Платформа',
      admin: { readOnly: true, description: 'Для диагностики протухания подписки (особенно iOS).' },
    },
    {
      name: 'userAgent',
      type: 'text',
      label: 'User-Agent',
      admin: { readOnly: true },
    },
    {
      name: 'lastSuccessAt',
      type: 'date',
      label: 'Последняя успешная отправка',
      admin: { readOnly: true, position: 'sidebar' },
    },
    {
      name: 'failureCount',
      type: 'number',
      label: 'Счётчик ошибок',
      defaultValue: 0,
      admin: {
        readOnly: true,
        position: 'sidebar',
        description: 'Dead-letter: при 410/404 запись удаляется сервисом отправки.',
      },
    },
  ],
  timestamps: true,
}
