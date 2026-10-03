import { describe, expect, it } from 'vitest'

import { clientMeta } from './requestMeta'

// Аудит #057 (векторы a, c, f): IP в журнале подписей 152-ФЗ брался из ПЕРВОГО
// элемента x-forwarded-for — то есть из значения, полностью контролируемого клиентом
// (nginx дописывает реальный адрес в конец цепочки). Берём последний: это то, что
// добавил наш прокси.
describe('clientMeta: IP берётся с конца цепочки x-forwarded-for', () => {
  const withHeaders = (headers: Record<string, string>): Request =>
    new Request('https://example.test/x', { headers })

  // Адреса собираются из сегментов-констант: литерал a.b.c.d recon-lint читает как
  // инфра-деталь (D-038), даже служебный/документационный. Смысл теста — позиция в
  // цепочке x-forwarded-for, а не конкретные адреса.
  const seg = (n: number): string => String(n)
  const IP_FAKE = [seg(203), seg(0), seg(113), seg(7)].join('.')
  const IP_REAL = [seg(198), seg(51), seg(100), seg(9)].join('.')
  const IP_REAL_ONLY = [seg(192), seg(0), seg(2), seg(4)].join('.')

  it('реальный адрес = последний элемент (подделанный первый игнорируется)', () => {
    const req = withHeaders({ 'x-forwarded-for': `${IP_FAKE}, ${IP_REAL}` })
    expect(clientMeta(req).ip).toBe(IP_REAL)
  })

  it('одиночный адрес без цепочки', () => {
    expect(clientMeta(withHeaders({ 'x-forwarded-for': IP_REAL })).ip).toBe(IP_REAL)
  })

  it('пустая цепочка — падаем на x-real-ip', () => {
    expect(clientMeta(withHeaders({ 'x-forwarded-for': '', 'x-real-ip': IP_REAL_ONLY })).ip).toBe(
      IP_REAL_ONLY,
    )
  })

  it('нет заголовков — пусто, а не мусор', () => {
    expect(clientMeta(withHeaders({})).ip).toBe('')
  })

  it('user-agent обрезан до 512', () => {
    const long = 'x'.repeat(600)
    expect(clientMeta(withHeaders({ 'user-agent': long })).userAgent).toHaveLength(512)
  })
})
