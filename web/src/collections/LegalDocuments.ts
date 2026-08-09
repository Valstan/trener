import type { CollectionConfig } from 'payload'

import { isOwner } from '../access/roles'
import { guardLegalDocument } from '../hooks/guardLegalDocument'

// Версионируемые юридические документы (D-016): договор поручения на обработку ПДн
// (kind=processing_agreement) и согласие родителя (kind=parent_consent).
//
// Ключевые свойства конструкции:
//   • текст — ДАННЫЕ: юр-правка = новая версия через админку, не релиз кода;
//   • опубликованная версия неизменяема (guardLegalDocument): подпись под текстом,
//     который потом отредактировали, не доказывает ничего;
//   • content_hash считается сервером в beforeChange — «под чем» подписывается
//     человек; журнал подписей (legal-signatures) хранит его снапшотом;
//   • body — шаблон с {{OPERATOR_*}}-плейсхолдерами: реквизиты подставляются из
//     филиала при показе, а на подписи фиксируются снапшотом в журнале.
//
// read — публичный: тексты показываются до логина (родителю на экране согласия,
// школе на экране подписания); ПДн в них нет — только шаблон.
export const LegalDocuments: CollectionConfig = {
  slug: 'legal-documents',
  labels: { singular: 'Юридический документ', plural: 'Юридические документы' },
  access: {
    read: () => true,
    create: ({ req }) => isOwner(req.user),
    update: ({ req }) => isOwner(req.user),
    // Удаление запрещено всем: на версию могут ссылаться подписи.
    delete: () => false,
  },
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['kind', 'version', 'title', 'publishedAt'],
    description:
      'Правка юридических текстов: опубликованную версию менять нельзя — выпустите новую (новая запись, свежий номер версии, дата публикации).',
  },
  hooks: {
    beforeValidate: [guardLegalDocument],
  },
  indexes: [{ fields: ['kind', 'version'], unique: true }],
  fields: [
    {
      name: 'kind',
      type: 'select',
      label: 'Вид документа',
      required: true,
      index: true,
      options: [
        { label: 'Договор поручения (школа)', value: 'processing_agreement' },
        { label: 'Согласие родителя', value: 'parent_consent' },
      ],
    },
    {
      name: 'version',
      type: 'text',
      label: 'Версия',
      required: true,
      maxLength: 40,
      admin: { description: 'Например 2026-08-09. Пара (вид, версия) уникальна.' },
    },
    { name: 'title', type: 'text', label: 'Заголовок', required: true, maxLength: 200 },
    {
      name: 'body',
      type: 'textarea',
      label: 'Текст (шаблон)',
      required: true,
      admin: {
        description:
          'Плейсхолдеры реквизитов филиала: {{OPERATOR_NAME}}, {{OPERATOR_LEGAL_FORM}}, {{OPERATOR_INN}}, {{OPERATOR_ADDRESS}}, {{OPERATOR_EMAIL}}, {{OPERATOR_PHONE}}, {{OPERATOR_RESPONSIBLE}}.',
      },
    },
    {
      name: 'contentHash',
      type: 'text',
      label: 'Отпечаток содержимого (sha256)',
      admin: { readOnly: true, description: 'Считается сервером. Под ним подписываются.' },
    },
    {
      name: 'publishedAt',
      type: 'date',
      label: 'Опубликован',
      index: true,
      admin: {
        position: 'sidebar',
        description: 'Пусто — черновик. С датой — действует; текст заморожен навсегда.',
      },
    },
  ],
  timestamps: true,
}
