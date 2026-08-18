import type { CollectionConfig } from 'payload'

import { adminOnly } from '../access/adminOnly'
import { isDemo, isFullOwner, ownerField } from '../access/roles'

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
    // Обе стороны изоляции D-029: демо видит ТОЛЬКО демо-филиал, живые не видят демо
    // («ФК Звёздочка» не всплывает в переключателе родителя). Живой owner видит всё —
    // ему демо-филиал нужен для присмотра.
    read: ({ req: { user } }) => {
      if (!user) return false
      if (isDemo(user)) return { isDemo: { equals: true } }
      if (isFullOwner(user)) return true
      return { isDemo: { not_equals: true } }
    },
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
      type: 'collapsible',
      label: 'Оператор персональных данных',
      admin: {
        description:
          'Оператор — сама школа. Платформа обрабатывает данные по её поручению. Документы становятся действующими после заполнения карточки и подписания договора поручения.',
        initCollapsed: true,
      },
      fields: [
        {
          name: 'operatorName',
          type: 'text',
          label: 'Полное наименование / ФИО ИП',
          maxLength: 240,
        },
        {
          name: 'operatorLegalForm',
          type: 'text',
          label: 'Организационно-правовая форма',
          maxLength: 120,
        },
        { name: 'operatorInn', type: 'text', label: 'ИНН', maxLength: 12 },
        { name: 'operatorAddress', type: 'textarea', label: 'Почтовый адрес', maxLength: 500 },
        { name: 'operatorEmail', type: 'email', label: 'Email по вопросам ПДн' },
        { name: 'operatorPhone', type: 'text', label: 'Телефон', maxLength: 40 },
        {
          name: 'operatorResponsiblePerson',
          type: 'text',
          label: 'Ответственный за обработку ПДн',
          maxLength: 240,
        },
        {
          name: 'processorAgreementSignedAt',
          type: 'date',
          label: 'Договор поручения подписан',
          admin: { date: { pickerAppearance: 'dayOnly' } },
        },
        {
          name: 'rknNotifiedAt',
          type: 'date',
          label: 'Уведомление РКН подано школой',
          admin: {
            date: { pickerAppearance: 'dayOnly' },
            description: 'Справочная дата. Уведомление подаёт школа-оператор, не платформа.',
          },
        },
      ],
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
    {
      name: 'isDemo',
      type: 'checkbox',
      label: 'Демо-филиал',
      defaultValue: false,
      access: { create: ownerField, update: ownerField },
      admin: {
        description: 'Витрина D-029: содержимое пересевается ночью, живым пользователям не показывается.',
      },
    },
  ],
  timestamps: true,
}
