import { describe, expect, it } from 'vitest'

import { legalContentHash, publishedFieldsFrozen, renderLegalBody, requisitesComplete } from './legal'

describe('legalContentHash', () => {
  it('стабилен для одинакового входа', () => {
    expect(legalContentHash('parent_consent', 'v1', 'текст')).toBe(legalContentHash('parent_consent', 'v1', 'текст'))
  })
  it('меняется от любого из kind/version/body', () => {
    const base = legalContentHash('parent_consent', 'v1', 'текст')
    expect(legalContentHash('processing_agreement', 'v1', 'текст')).not.toBe(base)
    expect(legalContentHash('parent_consent', 'v2', 'текст')).not.toBe(base)
    expect(legalContentHash('parent_consent', 'v1', 'текст.')).not.toBe(base)
  })
})

describe('publishedFieldsFrozen', () => {
  const published = { publishedAt: '2026-08-09', kind: 'parent_consent', version: 'v1', body: 'текст' }
  it('до публикации правка свободна', () => {
    expect(publishedFieldsFrozen({ ...published, publishedAt: null }, { body: 'другой' })).toBe(false)
  })
  it('после публикации kind/version/body заморожены', () => {
    expect(publishedFieldsFrozen(published, { body: 'другой' })).toBe(true)
    expect(publishedFieldsFrozen(published, { version: 'v2' })).toBe(true)
    expect(publishedFieldsFrozen(published, { kind: 'processing_agreement' })).toBe(true)
  })
  it('патч без этих полей / с теми же значениями — не нарушение', () => {
    expect(publishedFieldsFrozen(published, {})).toBe(false)
    expect(publishedFieldsFrozen(published, { body: 'текст' })).toBe(false)
  })
})

describe('renderLegalBody', () => {
  const operator = {
    name: 'ДЮСШ «Старт»',
    legalForm: 'МАУ ДО',
    inn: '4300000000',
    address: 'г. Малмыж, ул. Советская, 1',
    email: 'start@example.ru',
    phone: '+7 900 000-00-00',
    responsiblePerson: 'Иванова И.И.',
  }
  it('подставляет реквизиты филиала', () => {
    const out = renderLegalBody('Оператор: {{OPERATOR_NAME}}, ИНН {{OPERATOR_INN}}', operator)
    expect(out).toBe('Оператор: ДЮСШ «Старт», ИНН 4300000000')
  })
  it('неизвестный плейсхолдер остаётся видимым (не молча пусто)', () => {
    expect(renderLegalBody('{{UNKNOWN_FIELD}}', operator)).toBe('{{UNKNOWN_FIELD}}')
  })
  it('extras переопределяют и дополняют', () => {
    expect(renderLegalBody('{{CHILDREN}}', operator, { CHILDREN: 'Артём' })).toBe('Артём')
  })
})

describe('requisitesComplete', () => {
  const full = {
    id: 1,
    name: 'Филиал',
    operatorName: 'ДЮСШ',
    operatorLegalForm: 'МАУ ДО',
    operatorInn: '4300000000',
    operatorAddress: 'адрес',
    operatorEmail: 'a@b.ru',
    operatorPhone: '+7',
    processorAgreementSignedAt: null,
  }
  it('все реквизиты есть (без даты договора) → готов подписывать', () => {
    expect(requisitesComplete(full)).toBe(true)
  })
  it('пустой ИНН → не готов', () => {
    expect(requisitesComplete({ ...full, operatorInn: ' ' })).toBe(false)
  })
})
