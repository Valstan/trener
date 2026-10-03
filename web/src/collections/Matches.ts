import type { Access, CollectionConfig, PayloadRequest, Where } from 'payload'

import { adminOrCoachOwnGroup, createInOwnGroup } from '../access/byGroup'
import { adminBranchId, adminOrStaffField, branchGroupIds, childGroupIds, coachGroupIds, isChild, isFullOwner, isCoach, isParent, parentGroupIds } from '../access/roles'
import { cleanupMatchRelations } from '../hooks/cleanupMatchRelations'
import { demoGuestLimit } from '../hooks/demoGuestLimit'
import { fanOutMatchChange } from '../hooks/fanOutMatchChange'
import { denyParentWithoutConsent } from '@/lib/consentGate'
import { validateScorersGroup } from '@/lib/matches'
import { relId } from '@/lib/relId'

// Матчи (дорожная карта §4, после M3): расписание будущих игр (видение §3.1 —
// «когда, во сколько, где») и результаты сыгранных. Информационный канал поверх ядра
// M2 — как Announcements: НЕ ack-очередь, НЕ создаёт Notifications, НЕ влияет на
// coverage «N из M» (F1: ров = только изменения расписания, kickoff §1). Родитель
// видит матчи групп СВОИХ детей; тренер заводит матчи своих групп.
//
// «Сыгран» вычисляется из данных, а не из флага: счёт заполнен (оба поля) = сыгран,
// оба пусты = предстоит. Половина счёта — всегда ошибка ввода (валидация ниже).
//
// ⚠️ 152-ФЗ — МИНИМИЗАЦИЯ (kickoff §5, day-1 floor). Авторы голов (`scorers`) —
// relationship → players, хранит ТОЛЬКО имя ребёнка. Показывается всем родителям
// группы (расширение против Players.read, где родитель видит лишь своих детей) →
// цель обработки — публикация спортивного результата команды; должна быть покрыта
// целями согласия перед прод-выкаткой. Никаких иных детских данных в матче нет.
//
// #015 (authz по ролям): write — только тренер своей группы (adminOrCoachOwnGroup,
// по полю group); read — scoped плоский `{group:{in: ids}}` (G90-safe: служебные
// find в хелперах идут overrideAccess).
const readMatches: Access = async ({ req }) => {
  const { user } = req
  if (!user) return false
  if (isFullOwner(user)) return true
  // Админ филиала — контент групп своего филиала (M5).
  const branch = adminBranchId(user)
  if (branch != null) {
    const ids = await branchGroupIds(req, branch)
    if (!ids.length) return false
    return { group: { in: ids } }
  }
  if (isCoach(user)) {
    const ids = await coachGroupIds(req, user.id)
    if (!ids.length) return false
    const where: Where = { group: { in: ids } }
    return where
  }
  if (isParent(user)) {
    const ids = await parentGroupIds(req, user.id)
    if (!ids.length) return false
    const where: Where = { group: { in: ids } }
    return where
  }
  if (isChild(user)) {
    const ids = await childGroupIds(req, user.id)
    return ids.length ? { group: { in: ids } } : false
  }
  return false
}

export const readMatchParticipants = readMatches

// Счёт вводится парой: оба поля пустые (будущий матч) или оба заполнены (сыгранный).
const scorePairValidate = (
  value: number | null | undefined,
  otherValue: number | null | undefined,
): true | string => {
  if ((value == null) !== (otherValue == null)) {
    return 'Счёт вводится целиком: заполните оба поля или оставьте оба пустыми (будущий матч).'
  }
  return true
}

export const Matches: CollectionConfig = {
  slug: 'matches',
  labels: {
    singular: 'Матч',
    plural: 'Матчи',
  },
  access: {
    // Г211: Where на create не фильтрует, поэтому здесь createInOwnGroup (как у
    // Players/TrainingSessions после #015), а не adminOrCoachOwnGroup — иначе тренер
    // создавал матч в группе чужого филиала (аудит #057, вектор b).
    create: createInOwnGroup,
    read: readMatches,
    update: adminOrCoachOwnGroup,
    delete: adminOrCoachOwnGroup,
  },
  // Пуш родителям группы: назначен матч / перенесён / появился счёт (push-only,
  // без ack-очереди — ров остаётся у изменений расписания).
  hooks: {
    // 152-ФЗ (аудит #057 (c)): родителю без записанного согласия коллекция
    // с данными ребёнка недоступна через REST/GraphQL — UI-гейт обходится
    // адресной строкой и прямым API-вызовом.
    beforeOperation: [denyParentWithoutConsent],
    afterChange: [fanOutMatchChange],
    beforeChange: [demoGuestLimit],
    beforeDelete: [cleanupMatchRelations],
  },
  admin: {
    defaultColumns: ['matchDate', 'group', 'opponent', 'homeAway'],
    useAsTitle: 'opponent',
    description: 'Расписание игр и результаты — информационный раздел: подтверждения от родителей здесь не запрашиваются. Счёт пуст = будущий матч.',
  },
  fields: [
    // D-029: лимит 5 сущностей на демо-посетителя. Ставится ТОЛЬКО хуком
    // demoGuestLimit (field-access режет только клиентский ввод).
    {
      name: 'demoGuest',
      type: 'checkbox',
      defaultValue: false,
      admin: { hidden: true },
      access: { create: () => false, update: () => false },
    },
    {
      // Аудит #057 (вектор b): группа матча задаётся сервером (/coach/match) — из
      // REST клиент её не перевесить (иначе матч уезжает в чужую ветвь).
      name: 'group',
      type: 'relationship',
      label: 'Группа',
      relationTo: 'groups',
      required: true,
      index: true,
      access: { create: adminOrStaffField, update: adminOrStaffField },
    },
    {
      name: 'matchDate',
      type: 'date',
      label: 'Дата матча',
      required: true,
      index: true,
      admin: {
        date: { pickerAppearance: 'dayAndTime' },
      },
    },
    {
      name: 'opponent',
      type: 'text',
      label: 'Соперник',
      required: true,
      maxLength: 120,
    },
    {
      name: 'homeAway',
      type: 'select',
      label: 'Где',
      required: true,
      defaultValue: 'home',
      options: [
        { label: 'Дома', value: 'home' },
        { label: 'В гостях', value: 'away' },
      ],
      admin: { position: 'sidebar' },
    },
    {
      name: 'location',
      type: 'text',
      label: 'Место проведения',
      maxLength: 200,
    },
    {
      name: 'scoreOur',
      type: 'number',
      label: 'Голов наши',
      min: 0,
      validate: (value: number | null | undefined, { siblingData }: { siblingData: Partial<{ scoreOpponent?: number | null }> }) =>
        scorePairValidate(value, siblingData?.scoreOpponent),
    },
    {
      name: 'scoreOpponent',
      type: 'number',
      label: 'Голов соперник',
      min: 0,
      validate: (value: number | null | undefined, { siblingData }: { siblingData: Partial<{ scoreOur?: number | null }> }) =>
        scorePairValidate(value, siblingData?.scoreOur),
    },
    {
      name: 'scorers',
      type: 'array',
      label: 'Авторы голов',
      labels: { singular: 'Гол', plural: 'Голы' },
      admin: {
        description: 'Только имя ребёнка — из справочника «Дети». Видно родителям группы. Заполняется у сыгранного матча.',
      },
      validate: async (
        value: unknown,
        {
          siblingData,
          req,
        }: {
          siblingData: Partial<{ group?: unknown; scoreOur?: number | null; scoreOpponent?: number | null }>
          req: PayloadRequest
        },
      ) => {
        if (Array.isArray(value) && value.length > 0 && (siblingData?.scoreOur == null || siblingData?.scoreOpponent == null)) {
          return 'Авторы голов — только у сыгранного матча: сначала введите счёт.'
        }
        // Правило «гол — только ребёнок из группы матча» живёт ЗДЕСЬ, на уровне массива:
        // у вложенного поля `player` в payload 3.90.1 siblingData не содержит полей
        // матча, и проверка отвергала любую запись гола (03.10, отловлено падением
        // ночного демо-сида). Логика вынесена в validateScorersGroup и покрыта тестом.
        if (!Array.isArray(value) || value.length === 0) return true
        const playerIds = value
          .map((row) => relId((row as { player?: unknown })?.player))
          .filter((id): id is number => id != null)
        const groupsByPlayer = new Map<number, number | null>()
        if (playerIds.length) {
          const found = await req.payload.find({
            collection: 'players',
            where: { id: { in: playerIds } },
            depth: 0,
            pagination: false,
            overrideAccess: true,
          })
          for (const p of found.docs) groupsByPlayer.set(p.id, relId(p.group))
        }
        return validateScorersGroup(value, siblingData?.group, groupsByPlayer)
      },
      fields: [
        {
          name: 'player',
          type: 'relationship',
          label: 'Игрок',
          relationTo: 'players',
          required: true,
          // Выбор ограничен детьми ЭТОЙ группы (по полю group матча). filterOptions —
          // это только фильтр UI админки, не гейт: PATCH /api/matches/:id принимал
          // scorers с id ребёнка чужого филиала, и имя того ребёнка попадало родителям
          // другой ветки (аудит #057, векторы b, f). Роут /coach/match/result такую
          // проверку делает; через REST её обходили. Гейт по группе живёт на уровне
          // массива `scorers` (validateScorersGroup): у вложенного поля в payload
          // 3.90.1 siblingData не содержит полей матча, и проверка здесь отвергала
          // любую запись гола.
          filterOptions: ({ data }) =>
            data?.group ? { group: { equals: data.group } } : true,
        },
        {
          name: 'goals',
          type: 'number',
          label: 'Голов',
          required: true,
          defaultValue: 1,
          min: 1,
        },
      ],
    },
    {
      name: 'note',
      type: 'textarea',
      label: 'Заметка тренера',
      maxLength: 500,
    },
  ],
  timestamps: true,
}
