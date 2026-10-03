import type { Access, CollectionConfig, Where } from 'payload'
import { denyParentWithoutConsent } from '@/lib/consentGate'

import { adminOrCoachOwnGroup, createInOwnGroup } from '../access/byGroup'
import { cleanupPlayerRelations } from '../hooks/cleanupPlayerRelations'
import { demoGuestLimit } from '../hooks/demoGuestLimit'
import { adminBranchId, adminOrStaffField, branchGroupIds, coachGroupIds, isChild, isCoach, isFullOwner, isParent, ownerField } from '../access/roles'

// Ребёнок (игрок).
//
// ⚠️ 152-ФЗ — МИНИМИЗАЦИЯ (kickoff §4, маркетинговый дифференциатор «никаких СНИЛС»):
//   храним ТОЛЬКО имя + группа + ссылку на контакт родителя (relationship → users).
//   НЕ собираем: даты рождения сверх нужного, фото (MVP), здоровье, адреса,
//   СНИЛС/паспорт. Каждое поле — с заявленной целью.
//
// ⚠️ #015 (write-authz day-1): доступ строго по роли — родитель видит ТОЛЬКО своих
//   детей, тренер — ТОЛЬКО детей своих групп. НЕ «любой authenticated».
const readPlayers: Access = async ({ req }) => {
  const { user } = req
  if (!user) return false
  if (isFullOwner(user)) return true
  // Админ филиала — контент групп своего филиала (M5).
  const branch = adminBranchId(user)
  if (branch != null) {
    const ids = await branchGroupIds(req, branch)
    return { or: [{ group: { in: ids } }, { and: [{ branch: { equals: branch } }, { group: { exists: false } }] }] }
  }
  if (isCoach(user)) {
    const ids = await coachGroupIds(req, user.id)
    if (!ids.length) return false
    const groups = await req.payload.find({ collection: 'groups', where: { id: { in: ids } }, depth: 0, limit: 1000, pagination: false, overrideAccess: true })
    const branches = Array.from(new Set(groups.docs.map((group) => typeof group.branch === 'object' && group.branch ? group.branch.id : group.branch).filter((id): id is number => typeof id === 'number')))
    const where: Where = { or: [{ group: { in: ids } }, { and: [{ branch: { in: branches } }, { group: { exists: false } }] }] }
    return where
  }
  if (isParent(user)) {
    const where: Where = { parent: { equals: user.id } }
    return where
  }
  if (isChild(user)) return { account: { equals: user.id } }
  return false
}

export const Players: CollectionConfig = {
  slug: 'players',
  labels: {
    singular: 'Ребёнок',
    plural: 'Дети',
  },
  access: {
    create: createInOwnGroup,
    read: readPlayers,
    update: adminOrCoachOwnGroup,
    delete: adminOrCoachOwnGroup,
  },
  admin: {
    defaultColumns: ['name', 'group', 'parent'],
    useAsTitle: 'name',
    description:
      '152-ФЗ: минимизация. Только имя + группа + контакт родителя. Без дат рождения, фото, здоровья, адресов, СНИЛС.',
  },
  hooks: {
    // 152-ФЗ (аудит #057 (c)): родителю без записанного согласия коллекция
    // с данными ребёнка недоступна через REST/GraphQL — UI-гейт обходится
    // адресной строкой и прямым API-вызовом.
    beforeOperation: [denyParentWithoutConsent],
    // адресной строкой и API-вызовом.
    beforeChange: [demoGuestLimit],
    beforeDelete: [cleanupPlayerRelations],
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
      name: 'name',
      type: 'text',
      label: 'Имя ребёнка',
      required: true,
      maxLength: 100,
    },
    {
      name: 'dateOfBirth',
      type: 'date',
      label: 'Дата рождения',
      access: { create: ownerField, update: ownerField },
      admin: { description: 'Только для возрастной группы; не показывается участникам чатов.' },
    },
    {
      // Аудит #057 (вектор b): collection-access на update смотрит только на ТЕКУЩУЮ
      // группу документа, поэтому `PATCH /api/players/:id {"parent": …}` от тренера
      // переписывал законного представителя, а `{"group": …}` увозил ребёнка в чужую
      // ветвь. Привязки меняет сервер (/coach/player-group, /account/child-*), из REST
      // клиента — нельзя: admin.readOnly в UI не гейт, нужен access.
      name: 'group',
      type: 'relationship',
      label: 'Группа',
      relationTo: 'groups',
      required: false,
      access: { create: adminOrStaffField, update: adminOrStaffField },
    },
    {
      name: 'branch',
      type: 'relationship',
      label: 'Филиал',
      relationTo: 'branches',
      index: true,
      access: { create: adminOrStaffField, update: adminOrStaffField },
      admin: { description: 'Нужен для ребёнка, которому тренер ещё не назначил группу.' },
    },
    {
      // Лицо законного представителя — запись, которой система доверяет (уведомления,
      // RSVP, вопросы). Меняет только сервер (приглашение/аккаунт ребёнка).
      name: 'parent',
      type: 'relationship',
      label: 'Родитель (контакт)',
      relationTo: 'users',
      access: { create: ownerField, update: ownerField },
      filterOptions: () => ({ roles: { in: ['parent'] } }),
      admin: {
        description:
          'Аккаунт родителя — контакт и адресат уведомлений. Привязывается сам, когда родитель принимает приглашение по ссылке.',
      },
    },
    {
      name: 'account',
      type: 'relationship',
      label: 'Аккаунт ребёнка',
      relationTo: 'users',
      unique: true,
      access: { create: ownerField, update: ownerField },
      filterOptions: () => ({ roles: { in: ['child'] } }),
      admin: { readOnly: true, description: 'Создаётся родителем в разделе «Аккаунт».' },
    },
    {
      // Кнопка генерации ссылки-приглашения родителю (sidebar). Сама привязка —
      // через /join + magic-link (см. lib/auth/invite). Доступ к генерации
      // ограничен на стороне endpoint /auth/invite (staff + своя группа, #015).
      name: 'inviteLink',
      type: 'ui',
      admin: {
        position: 'sidebar',
        components: {
          Field: '@/components/admin/GenerateInviteLink',
        },
      },
    },
  ],
  timestamps: true,
}
