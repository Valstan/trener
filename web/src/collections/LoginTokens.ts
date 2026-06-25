import type { CollectionConfig } from 'payload'

// Одноразовые токены входа по magic-link (passwordless онбординг — экзистенциально
// для адопшена, kickoff §7.1). Системная коллекция: создаётся/читается ТОЛЬКО
// сервером через overrideAccess (endpoint'ы request-login/verify). Наружу закрыта
// полностью и скрыта из админ-навигации.
//
// Безопасность:
//   • В БД храним ТОЛЬКО sha256-хеш токена (tokenHash) — утечка таблицы не раскрывает
//     живые ссылки. Сырой токен живёт лишь в письме/URL.
//   • single-use (usedAt) + короткий TTL (expiresAt, 30 мин) — узкое окно повтора.
//   • purpose: 'login' — вход существующего юзера; 'invite' — онбординг родителя по
//     приглашению тренера (привязка к player). Invite-ветка приходит отдельным PR.
export const LoginTokens: CollectionConfig = {
  slug: 'login-tokens',
  labels: {
    singular: 'Токен входа',
    plural: 'Токены входа',
  },
  access: {
    // Системная коллекция: только сервер (overrideAccess). Никакой роли — даже админу.
    create: () => false,
    read: () => false,
    update: () => false,
    delete: () => false,
  },
  admin: {
    hidden: true,
  },
  fields: [
    {
      name: 'tokenHash',
      type: 'text',
      required: true,
      index: true,
    },
    {
      name: 'purpose',
      type: 'select',
      required: true,
      defaultValue: 'login',
      options: [
        { label: 'Вход', value: 'login' },
        { label: 'Приглашение', value: 'invite' },
      ],
    },
    {
      name: 'email',
      type: 'text',
      required: true,
    },
    {
      name: 'user',
      type: 'relationship',
      relationTo: 'users',
      // Задан для purpose 'login' (существующий пользователь).
    },
    {
      name: 'player',
      type: 'relationship',
      relationTo: 'players',
      // Задан для purpose 'invite' — какого ребёнка привязать к родителю.
    },
    {
      name: 'expiresAt',
      type: 'date',
      required: true,
    },
    {
      name: 'usedAt',
      type: 'date',
      // Проставляется при консьюме — флаг single-use.
    },
  ],
  timestamps: true,
}
