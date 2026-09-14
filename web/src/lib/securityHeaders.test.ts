import { describe, expect, it } from 'vitest'

import { securityHeaders } from './securityHeaders'

// Гейт на заголовки безопасности (14.09.2026). До этой даты приложение не отдавало ни
// одного — и заметил это не мы, а Мозг снаружи через `curl -sI`. Заголовок — контракт,
// который ломается молча: он не падает в сборке, не роняет тест и не виден на экране,
// поэтому пропажу видно только тем же curl'ом по проду. Отсюда этот файл.
//
// Мутационная приёмка (#114): убрать любую строку из `securityHeaders` в next.config.ts
// или дописать в CSP `script-src` — соответствующий тест ниже краснеет.

const byKey = (key: string) =>
  securityHeaders.find((h) => h.key.toLowerCase() === key.toLowerCase())?.value

describe('securityHeaders', () => {
  it('отдаёт все пять заголовков', () => {
    expect(securityHeaders.map((h) => h.key).sort()).toEqual([
      'Content-Security-Policy',
      'Referrer-Policy',
      'Strict-Transport-Security',
      'X-Content-Type-Options',
      'X-Frame-Options',
    ])
  })

  describe('CSP', () => {
    const csp = () => byKey('Content-Security-Policy') ?? ''

    it('закрывает кликджекинг, отправку форм и подмену <base>', () => {
      expect(csp()).toContain("frame-ancestors 'self'")
      expect(csp()).toContain("form-action 'self'")
      expect(csp()).toContain("base-uri 'self'")
    })

    // Не «забыли добавить», а сознательное решение: админка Payload и счётчик Метрики
    // на inline-скриптах, поэтому script-src здесь СЛОМАЕТ прод, а не защитит его.
    // Полная CSP с nonce — отдельная работа. Тест держит решение явным: кто добавит
    // script-src мимоходом, увидит красный и прочитает этот комментарий.
    it('намеренно без script-src/style-src — они требуют nonce и уронят админку', () => {
      expect(csp()).not.toContain('script-src')
      expect(csp()).not.toContain('style-src')
    })

    // У портала в form-action стоит origin ЕСА — их выход POST-форма с 303 на
    // end_session. У нас выход это fetch, а вход через Радар — GET-ссылка, поэтому
    // чужих origin'ов в form-action быть не должно: CSP тем ценнее, чем она уже.
    it('form-action не содержит чужих origin — у нас нет форм, уходящих наружу', () => {
      expect(csp()).not.toContain('http://')
      expect(csp()).not.toContain('https://')
    })
  })

  // Мы поддомен вмалмыже.рф; соседние поддомены — чужие проекты кластера. HSTS с
  // includeSubDomains решал бы за них, и откатить это нельзя до истечения max-age.
  it('HSTS без includeSubDomains — за соседние поддомены не решаем', () => {
    expect(byKey('Strict-Transport-Security')).toBe('max-age=31536000')
    expect(byKey('Strict-Transport-Security')).not.toContain('includeSubDomains')
  })

  it('nosniff, Referrer-Policy и X-Frame-Options на месте', () => {
    expect(byKey('X-Content-Type-Options')).toBe('nosniff')
    expect(byKey('Referrer-Policy')).toBe('strict-origin-when-cross-origin')
    expect(byKey('X-Frame-Options')).toBe('SAMEORIGIN')
  })
})
