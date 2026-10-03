import type { Access, CollectionConfig } from 'payload'

import { adminOnly } from '../access/adminOnly'
import { adminOrSelf } from '../access/adminOrSelf'
import { hasRole, isDemo, ownerField, rolesField } from '../access/roles'
import { cleanupUserRelations } from '../hooks/cleanupUserRelations'
import { ensureFirstUserAdmin } from '../hooks/ensureFirstUserAdmin'
import { blockFirstRegister } from './firstRegisterGuard'


export const Users: CollectionConfig = {
  slug: 'users',
  labels: {
    singular: 'Пользователь',
    plural: 'Пользователи',
  },
  access: {
    // Вход в админку: персонал (owner + admin + coach), КРОМЕ демо-юзеров.
    // Родители работают в PWA-клиенте, не в админ-панели. Демо — витринный тур,
    // /admin — рабочее место живого staff (D-029/#133): даже демо-owner/admin
    // в панель не пускаем.
    admin: ({ req: { user } }) =>
      hasRole(user, 'owner', 'admin', 'coach') && !(user as { demo?: boolean } | null)?.demo,
    create: adminOnly,
    delete: adminOnly,
    read: adminOrSelf,
    // Демо-юзерам update users закрыт целиком (I1, D-029): демо-аккаунты общие —
    // любой посетитель мог бы сменить себе email/password/name через
    // adminOrSelf.update и сломать /demo/login до ночного reseed'а, а вписав
    // чужой реальный email — засквоттить его через users.email unique. «Сменить
    // роль» в демо-туре правки users не требует, так что запрет ничего не ломает.
    update: ((args) => (isDemo(args.req.user) ? false : adminOrSelf(args))) as Access,
  },
  admin: {
    defaultColumns: ['name', 'email', 'requestedRole', 'roles', 'status', 'branch'],
    useAsTitle: 'name',
  },
  // secure:true — НЕ дефолт Payload (`secure:false` в authDefaults). Сайт публичный и
  // только HTTPS; без флага session-cookie уезжает открытым текстом на любой
  // http://-запрос (HSTS не помогает до первого успешного HTTPS-кеша, preload не включён).
  // Аудит #057 (вектор d), подтверждено независимо вектором c.
  //
  // maxAge/expires — явные: дефолт Payload = сессионная cookie (без срока, живёт до
  // закрытия браузера). Здесь фиксированное время жизни сессии = tokenExpiration (2 ч).
  auth: {
    cookies: { secure: true, sameSite: 'Lax' },
  },
  // Аудит #057 (вектор a): `POST /api/users/first-register` у Payload НЕ гейтится
  // полем roles — registerFirstUser делает `payload.create({overrideAccess:true})`,
  // а ensureFirstUserAdmin повышает первого юзера до owner. Свой endpoint с тем же
  // путём перекрывает встроенный (Payload отдаёт custom раньше штатного).
  // Единственный законный путь создания первого админа — seed-скрипты
  // (`pnpm seed`, `seed:legal`), а не анонимный HTTP-вызов.
  endpoints: [blockFirstRegister],

  // Пара (authProvider, externalId) уникальна: одна внешняя личность — один аккаунт.
  // NULL-пары (обычные email-пользователи) под уникальность не попадают.
  indexes: [{ fields: ['authProvider', 'externalId'], unique: true }],
  fields: [
    {
      name: 'name',
      type: 'text',
      label: 'Имя',
    },
    {
      name: 'phone',
      type: 'text',
      label: 'Телефон',
      maxLength: 32,
      admin: {
        description: 'Контакт тренера/родителя. 152-ФЗ: минимизация — только для связи.',
      },
    },
    {
      name: 'roles',
      type: 'select',
      label: 'Роли',
      hasMany: true,
      required: true,
      // Наименее привилегированная роль по умолчанию. Первый пользователь повышается
      // до owner хуком ensureFirstUserAdmin; персонал назначает роли вручную.
      defaultValue: ['parent'],
      saveToJWT: true,
      options: [
        { label: 'Владелец сети', value: 'owner' },
        { label: 'Администратор филиала', value: 'admin' },
        { label: 'Тренер', value: 'coach' },
        { label: 'Родитель', value: 'parent' },
        { label: 'Ребёнок', value: 'child' },
        { label: 'Заявитель (без доступов)', value: 'applicant' },
      ],
      access: {
        // Защита от самоповышения: owner — любые роли; админ филиала — только
        // coach/parent в своём филиале (rolesField, M5).
        update: rolesField,
      },
    },
    {
      name: 'demo',
      type: 'checkbox',
      label: 'Демо-аккаунт',
      defaultValue: false,
      saveToJWT: true,
      access: { create: ownerField, update: ownerField },
      admin: {
        description: 'Общий витринный аккаунт D-029; исходящие пуш/email глушатся.',
      },
    },
    {
      name: 'requestedRole',
      type: 'select',
      label: 'Роль, выбранная при регистрации',
      saveToJWT: true,
      options: [
        { label: 'Родитель', value: 'parent' },
        { label: 'Тренер', value: 'coach' },
        { label: 'Ребёнок', value: 'child' },
      ],
      // Аудит #057 (вектор b): у поля не было НИ create, НИ update access, поэтому
      // `PATCH /api/users/<свой id> {"requestedRole":"coach"}` проходил мимо экрана
      // выбора роли (он отказывает, когда роль уже задана) и сразу ставил заявку в
      // инбокс владельца с подменённой ролью — а роль по заявке берётся именно отсюда.
      // admin.readOnly защищает только UI. Теперь роль выбирает сервер (/onboarding/role/select).
      access: { create: () => false, update: () => false },
      admin: { readOnly: true, description: 'Самостоятельный выбор до одобрения заявки.' },
    },
    {
      // Логин — половина учётных данных ребёнка (вход по нему в /auth/password-login).
      // Аудит #057 (вектор b): у поля были гейты только на запись, а `adminOrSelf.read`
      // отдаёт филиальному админу всех пользователей ЕГО филиала — вместе с логинами
      // детей и SSO-sub'ами всех, кого он не администрирует. На чтение оставляем
      // только полный owner.
      name: 'login',
      type: 'text',
      label: 'Логин ребёнка',
      unique: true,
      index: true,
      access: { create: ownerField, update: ownerField, read: ownerField },
      admin: { description: 'Только для детского входа; взрослые входят по email/VK.' },
    },
    // ── Связь с внешней личностью центра авторизации «Радар» (SSO через VK) ──
    // Заполняются ТОЛЬКО серверным путём VK-входа (findOrLinkRadarUser,
    // overrideAccess) либо админом вручную (отвязать аккаунт). Самослужебное
    // редактирование закрыто: иначе пользователь привязал бы чужой sub к себе.
    {
      name: 'authProvider',
      type: 'select',
      label: 'Внешний провайдер входа',
      options: [{ label: 'Радар-ID (VK)', value: 'radar' }],
      access: {
        create: ownerField,
        update: ownerField,
      },
      admin: {
        description: 'SSO-провайдер, через который связан аккаунт. Пусто — вход по email.',
      },
    },
    {
      name: 'externalId',
      type: 'text',
      label: 'Внешний ID (sub)',
      access: {
        create: ownerField,
        update: ownerField,
        // sub внешней личности — идентификатор, по которому вход ищет аккаунт
        // (radarLink). Админу филиала он не нужен (аудит #057, вектор b).
        read: ownerField,
      },
      admin: {
        description: 'Стабильный идентификатор личности у провайдера (sub Радара).',
      },
    },
    // ── M5: филиал и модерация входа (docs/m5-design.md §2–3) ──
    {
      name: 'branch',
      type: 'relationship',
      label: 'Филиал',
      relationTo: 'branches',
      saveToJWT: true,
      access: {
        // Переводит между филиалами только владелец (админ филиала — в PR-B,
        // вместе с экраном заявок).
        create: ownerField,
        update: ownerField,
      },
      admin: {
        description:
          'Филиал участника — граница видимости. Пусто — только у владельцев сети.',
      },
    },
    {
      name: 'status',
      type: 'select',
      label: 'Статус участника',
      required: true,
      // PR-A: default approved — гейт модерации входа (pending + серверные
      // проверки контента) включается в PR-B вместе с экраном заявок, чтобы не
      // оставить пол-состояния. Существующие юзеры бэкфиллятся approved миграцией.
      defaultValue: 'approved',
      saveToJWT: true,
      options: [
        { label: 'Ждёт подтверждения', value: 'pending' },
        { label: 'Подтверждён', value: 'approved' },
      ],
      access: {
        create: ownerField,
        update: ownerField,
      },
    },
  ],
  hooks: {
    beforeChange: [ensureFirstUserAdmin],
    beforeDelete: [cleanupUserRelations],
  },
  timestamps: true,
}
