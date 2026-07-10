import { describe, expect, it } from 'vitest'

import {
  extractClaims,
  normalizeUrl,
  openTransaction,
  pkceChallenge,
  sanitizeNextPath,
  sealTransaction,
} from './oidc'

describe('pkceChallenge — S256 (RFC 7636)', () => {
  it('эталонный вектор из RFC 7636 Appendix B', () => {
    expect(pkceChallenge('dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk')).toBe(
      'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM',
    )
  })
})

describe('normalizeUrl — punycode-нормализация (G108)', () => {
  it('кириллический IDN → punycode (символ-в-символ с регистрацией у Радара)', () => {
    expect(normalizeUrl('https://интер.вмалмыже.рф/auth/vk/callback')).toBe(
      'https://xn--e1afpni.xn--80adkdyec4j.xn--p1ai/auth/vk/callback',
    )
    expect(normalizeUrl('https://вход.вмалмыже.рф')).toBe(
      'https://xn--b1ae3a1a.xn--80adkdyec4j.xn--p1ai',
    )
  })

  it('уже-punycode проходит без изменений; хвостовой слэш срезается', () => {
    expect(normalizeUrl('https://xn--b1ae3a1a.xn--80adkdyec4j.xn--p1ai/')).toBe(
      'https://xn--b1ae3a1a.xn--80adkdyec4j.xn--p1ai',
    )
  })

  it('мусор → null (SSO считается несконфигурированным, не падаем)', () => {
    expect(normalizeUrl('не-url')).toBeNull()
    expect(normalizeUrl('')).toBeNull()
  })
})

describe('sealTransaction / openTransaction — подписанная OIDC-транзакция', () => {
  const SECRET = 'test-payload-secret'
  const TX = { state: 'st-123', nonce: 'n-456', verifier: 'v-789' }

  it('roundtrip: seal → open возвращает исходную транзакцию', () => {
    expect(openTransaction(sealTransaction(TX, SECRET), SECRET)).toEqual(TX)
  })

  it('подделка данных → null (HMAC не сходится)', () => {
    const sealed = sealTransaction(TX, SECRET)
    const [data, sig] = sealed.split('.')
    const forged = Buffer.from(
      JSON.stringify({ ...TX, state: 'attacker' }),
    ).toString('base64url')
    expect(openTransaction(`${forged}.${sig}`, SECRET)).toBeNull()
    expect(openTransaction(`${data}.AAAA${sig!.slice(4)}`, SECRET)).toBeNull()
  })

  it('чужой секрет → null (cookie с другого стенда не принимается)', () => {
    expect(openTransaction(sealTransaction(TX, SECRET), 'other-secret')).toBeNull()
  })

  it('мусор/пустота/неполная транзакция → null, без исключений', () => {
    expect(openTransaction('', SECRET)).toBeNull()
    expect(openTransaction('no-dot', SECRET)).toBeNull()
    expect(openTransaction('a.b', SECRET)).toBeNull()
    const partial = { state: 'x', nonce: 'y' } // без verifier
    const data = Buffer.from(JSON.stringify(partial)).toString('base64url')
    const sealed = sealTransaction(TX, SECRET)
    const sig = sealed.slice(sealed.lastIndexOf('.') + 1)
    expect(openTransaction(`${data}.${sig}`, SECRET)).toBeNull()
  })
})

describe('sanitizeNextPath — гард open-redirect для ?next=', () => {
  it('внутренний путь проходит', () => {
    expect(sanitizeNextPath('/join/abc-123')).toBe('/join/abc-123')
    expect(sanitizeNextPath('/parent?tab=queue')).toBe('/parent?tab=queue')
  })

  it('внешние/протокольные формы отбрасываются (open-redirect)', () => {
    expect(sanitizeNextPath('https://evil.example')).toBeNull()
    expect(sanitizeNextPath('//evil.example/phish')).toBeNull()
    expect(sanitizeNextPath('/\\evil.example')).toBeNull()
    expect(sanitizeNextPath('javascript:alert(1)')).toBeNull()
  })

  it('мусор/границы: не строка, пусто, голый /, сверхдлинное → null', () => {
    expect(sanitizeNextPath(null)).toBeNull()
    expect(sanitizeNextPath(undefined)).toBeNull()
    expect(sanitizeNextPath('')).toBeNull()
    expect(sanitizeNextPath('/')).toBeNull()
    expect(sanitizeNextPath('/' + 'a'.repeat(600))).toBeNull()
  })
})

describe('транзакция с next — roundtrip и фильтрация', () => {
  const SECRET = 'test-payload-secret'

  it('валидный next переживает seal → open', () => {
    const tx = { state: 's', nonce: 'n', verifier: 'v', next: '/join/tok-1' }
    expect(openTransaction(sealTransaction(tx, SECRET), SECRET)).toEqual(tx)
  })

  it('невалидный next отбрасывается при open (вход продолжается по роли)', () => {
    const tx = { state: 's', nonce: 'n', verifier: 'v', next: '//evil.example' }
    expect(openTransaction(sealTransaction(tx, SECRET), SECRET)).toEqual({
      state: 's',
      nonce: 'n',
      verifier: 'v',
    })
  })
})

describe('extractClaims — выжимка личности из проверенного id_token', () => {
  it('полный набор: email нормализуется в нижний регистр', () => {
    expect(
      extractClaims({
        sub: 'uuid-1',
        email: ' Olga@Example.RU ',
        email_verified: true,
        name: ' Ольга ',
      }),
    ).toEqual({ sub: 'uuid-1', email: 'olga@example.ru', emailVerified: true, name: 'Ольга' })
  })

  it('email_verified строго boolean true: строки/1/отсутствие → false (анти-захват §3.3)', () => {
    expect(extractClaims({ sub: 's', email: 'a@b.ru', email_verified: 'true' }).emailVerified).toBe(
      false,
    )
    expect(extractClaims({ sub: 's', email: 'a@b.ru', email_verified: 1 }).emailVerified).toBe(
      false,
    )
    expect(extractClaims({ sub: 's', email: 'a@b.ru' }).emailVerified).toBe(false)
  })

  it('email без @ или не-строка → null', () => {
    expect(extractClaims({ sub: 's', email: 'not-an-email' }).email).toBeNull()
    expect(extractClaims({ sub: 's', email: 42 as unknown as string }).email).toBeNull()
    expect(extractClaims({ sub: 's' }).email).toBeNull()
  })

  it('пустой/отсутствующий sub → исключение (без якоря личность не связываем)', () => {
    expect(() => extractClaims({ email: 'a@b.ru' })).toThrow()
    expect(() => extractClaims({ sub: '   ' })).toThrow()
  })
})
