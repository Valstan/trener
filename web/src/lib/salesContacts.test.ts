import { describe, expect, it } from 'vitest'

import { SALES_CONTACTS } from './salesContacts'

// Контакты уходят в чужой браузер и в телефонную звонилку: сторожим то, что
// ломается молча — опечатка в схеме (клик никуда не ведёт), не-ASCII в href
// (мутирует при перекодировках, как в ecosystem.ts) и телефон, записанный не в
// E.164 (звонилка на Android не наберёт номер с пробелами и восьмёркой).
describe('SALES_CONTACTS', () => {
  it('не пустой и без дублей по каналу', () => {
    expect(SALES_CONTACTS.length).toBeGreaterThan(0)
    const labels = SALES_CONTACTS.map((c) => c.label)
    expect(new Set(labels).size).toBe(labels.length)
  })

  it('каждый пункт заполнен человекочитаемо', () => {
    for (const c of SALES_CONTACTS) {
      expect(c.ic.length).toBeGreaterThan(0)
      expect(c.label.trim().length).toBeGreaterThan(0)
      expect(c.value.trim().length).toBeGreaterThan(0)
    }
  })

  it('href — только ASCII и только ожидаемые схемы', () => {
    for (const c of SALES_CONTACTS.filter((x) => x.href != null)) {
      expect(c.href).toMatch(/^[\x20-\x7e]+$/)
      expect(c.href).toMatch(/^(https|mailto|tel):/)
    }
  })

  it('внешние ссылки — валидные https-адреса', () => {
    for (const c of SALES_CONTACTS.filter((x) => x.href?.startsWith('https'))) {
      expect(new URL(c.href as string).protocol).toBe('https:')
    }
  })

  it('телефон в href записан в E.164 — без пробелов, скобок и ведущей восьмёрки', () => {
    for (const c of SALES_CONTACTS.filter((x) => x.href?.startsWith('tel:'))) {
      expect(c.href).toMatch(/^tel:\+[0-9]+$/)
    }
  })

  it('почта в href — один адрес с @ и без пробелов', () => {
    for (const c of SALES_CONTACTS.filter((x) => x.href?.startsWith('mailto:'))) {
      expect(c.href).toMatch(/^mailto:[^\s@]+@[^\s@]+\.[^\s@]+$/)
    }
  })
})
