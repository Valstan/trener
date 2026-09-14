import { readFileSync } from 'fs'
import { join } from 'path'

import { describe, expect, it } from 'vitest'

import { SITE_DESCRIPTION, SITE_URL } from './site'
import { organizationJsonLd } from './structuredData'

// Гейт SEO/GEO-разметки (D-088). Две разные вещи проверяются разными способами:
// форма JSON-LD — обычным юнитом, canonical — чтением исходника layout (server
// component с `import './globals.css'` юнит-тестом не поднять; тот же приём, что в
// demoReadScope.test.ts).

describe('organizationJsonLd', () => {
  const ld = organizationJsonLd(SITE_URL, SITE_DESCRIPTION)

  it('валидный Organization с именем, адресом сайта и городом', () => {
    expect(ld['@context']).toBe('https://schema.org')
    expect(ld['@type']).toBe('Organization')
    expect(ld.name).toBe('Интер')
    expect(ld.url).toBe(SITE_URL)
    expect(ld.areaServed).toEqual({ '@type': 'City', name: 'Малмыж' })
  })

  it('сериализуется в JSON без потерь (его кладут в <script> строкой)', () => {
    expect(() => JSON.parse(JSON.stringify(ld))).not.toThrow()
  })

  // ГЛАВНАЯ проверка файла, и она про то, чего в разметке БЫТЬ НЕ ДОЛЖНО.
  //
  // Контакты на лендинге принадлежат разработчику платформы, а не футбольной школе
  // «Интер». Соблазн «раз телефон на странице есть — положим его в Organization»
  // выглядит как улучшение SEO, а на деле разводит NAP-рассинхрон с карточкой школы
  // в Яндекс Бизнесе, и поисковик, сверив их, понизит доверие к обеим. Пока владелец
  // не дал реальные реквизиты школы, этих полей здесь быть не может.
  it('НЕ содержит выдуманных реквизитов школы', () => {
    for (const forbidden of ['address', 'telephone', 'email', 'openingHours', 'foundingDate']) {
      expect(ld, `поле ${forbidden} требует реальных данных школы, а не контактов разработчика`).not.toHaveProperty(forbidden)
    }
    // Телефон разработчика не должен просочиться ни в одно поле любой вложенности.
    expect(JSON.stringify(ld)).not.toMatch(/9229005910|922 900-59-10|valstan/i)
  })
})

describe('canonical в корневом layout (G312)', () => {
  const layout = readFileSync(join(process.cwd(), 'src/app/(frontend)/layout.tsx'), 'utf8')

  it("canonical задан относительным './' — иначе каждая страница унаследует адрес главной", () => {
    expect(layout).toMatch(/alternates:\s*\{\s*canonical:\s*'\.\/'\s*\}/)
  })

  // Красный путь этого гейта: заменить './' на SITE_URL или любую абсолютную строку —
  // ровно та правка, которая выглядит «понятнее» и молча схлопывает весь сайт в одну
  // каноническую страницу. G312 в пуле описывает именно этот случай.
  it('canonical НЕ абсолютный', () => {
    const m = layout.match(/canonical:\s*([^,\n}]+)/)
    expect(m, 'canonical пропал из layout').toBeTruthy()
    expect(m?.[1]).not.toMatch(/https?:|SITE_URL|metadataBase/)
  })
})
