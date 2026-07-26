import { describe, expect, it } from 'vitest'

import { SERVICES_CATALOG_URL } from './ecosystem'

// Ссылка уходит наружу и в чужой браузер — сторожим ровно то, что ломается молча:
// не-ASCII в литерале (кириллица в исходнике мутирует при перекодировках) и схему.
describe('SERVICES_CATALOG_URL', () => {
  it('является https-ссылкой на /services', () => {
    const url = new URL(SERVICES_CATALOG_URL)
    expect(url.protocol).toBe('https:')
    expect(url.pathname).toBe('/services')
  })

  it('записан в punycode — только ASCII', () => {
    expect(SERVICES_CATALOG_URL).toMatch(/^[\x20-\x7e]+$/)
    expect(new URL(SERVICES_CATALOG_URL).hostname).toBe('xn--b1ae3a1a.xn--80adkdyec4j.xn--p1ai')
  })
})
