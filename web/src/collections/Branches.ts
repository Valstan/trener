import type { CollectionConfig } from 'payload'

import { adminOnly } from '../access/adminOnly'

// Филиал сети (M5, docs/m5-design.md §1) — верхняя граница видимости: участник
// живёт в одном филиале, контент наследует филиал через groups.branch.
// CRUD — только владелец; читают все вошедшие (списки/переключатель филиала).
export const Branches: CollectionConfig = {
  slug: 'branches',
  labels: {
    singular: 'Филиал',
    plural: 'Филиалы',
  },
  access: {
    create: adminOnly,
    delete: adminOnly,
    read: ({ req: { user } }) => Boolean(user),
    update: adminOnly,
  },
  admin: {
    defaultColumns: ['name', 'city', 'active'],
    useAsTitle: 'name',
  },
  fields: [
    {
      name: 'name',
      type: 'text',
      label: 'Название',
      required: true,
      maxLength: 120,
    },
    {
      name: 'city',
      type: 'text',
      label: 'Город',
      maxLength: 120,
    },
    {
      name: 'paymentDetails',
      type: 'textarea',
      label: 'Реквизиты оплаты',
      maxLength: 2000,
      admin: {
        description:
          'Реквизиты и инструкция для родителей: куда и как платить, сколько стоит абонемент. Показываются родителю на экране «Оплата».',
      },
    },
    {
      name: 'monthlyFee',
      type: 'number',
      label: 'Абонемент на месяц, ₽',
      min: 0,
      max: 1000000,
      admin: {
        description:
          'Цена по умолчанию для всех групп филиала. Родитель видит её как «к оплате», когда абонемент кончается или уже просрочен. У отдельной группы цену можно задать свою.',
      },
    },
    {
      name: 'paymentUrl',
      type: 'text',
      label: 'Ссылка на форму оплаты',
      maxLength: 500,
      admin: {
        description: 'Необязательно: ссылка/QR-цель, открывающая форму оплаты с реквизитами.',
      },
    },
    {
      name: 'active',
      type: 'checkbox',
      label: 'Действующий',
      defaultValue: true,
      admin: {
        description: 'Снять галочку = закрыть филиал, не удаляя его историю.',
      },
    },
  ],
  timestamps: true,
}
