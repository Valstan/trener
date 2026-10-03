import { describe, expect, it } from 'vitest'

import { clientMeta } from './requestMeta'

// Аудит #057 (векторы a, c, f): IP в журнале подписей 152-ФЗ брался из ПЕРВОГО
// элемента x-forwarded-for — то есть из значения, полностью контролируемого клиентом
// (nginx дописывает реальный адрес в конец цепочки). Берём последний: это то, что
// добавил наш прокси.
describe('clientMeta: IP берётся с конца цепочки x-forwarded-for', () => {
  const withHeaders = (headers: Record<string, string>): Request =>
    new Request('https://example.test/x', { headers })

  it('реальный адрес = последний элемент (подделанный первый игнорируется)', () => {
    const req = withHeaders({ 'x-forwarded-for': '203.0.113.7, 198.51.100.9' })
    expect(clientMeta(req).ip).toBe('198.51.100.9')
  })

  it('одиночный адрес без цепочки', () => {
    expect(clientMeta(withHeaders({ 'x-forwarded-for': '198.51.100.9' })).ip).toBe('198.51.100.9')
  })

  it('пустая цепочка — падаем на x-real-ip', () => {
    expect(clientMeta(withHeaders({ 'x-forwarded-for': '', 'x-real-ip': '192.0.2.4' })).ip).toBe('192.0.2.4')
  })

  it('нет заголовков — пусто, а не мусор', () => {
    expect(clientMeta(withHeaders({})).ip).toBe('')
  })

  it('user-agent обрезан до 512', () => {
    const long = 'x'.repeat(600)
    expect(clientMeta(withHeaders({ 'user-agent': long })).userAgent).toHaveLength(512)
  })
})
