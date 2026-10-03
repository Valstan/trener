import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

// Гейт согласия 152-ФЗ на ВСЮ родительскую поверхность (аудит #057 (c)).
//
// Почему гейт СПИСОМ, а не «как-нибудь»: единственный экземпляр проверки стоял только
// на `/parent`, и стоило бы добавить двадцатый экран родителя — он получил бы данные
// ребёнка без согласия, молча и с зелёными тестами. Теперь любой page.tsx/route.ts в
// деревьях parent/chat обязан звать гейт; новый файл без вызова роняет тест.

const frontend = fileURLToPath(new URL('../app/(frontend)/', import.meta.url))

const walk = (dir: string): string[] =>
  require('node:fs')
    .readdirSync(dir, { withFileTypes: true })
    .flatMap((e: { name: string; isDirectory(): boolean }) => {
      const full = `${dir}/${e.name}`
      if (e.isDirectory()) return walk(full)
      return /\/(page|route)\.tsx?$/.test(full) ? [full] : []
    })

const surface = [...walk(`${frontend}/parent`), ...walk(`${frontend}/chat`)]
const rel = (p: string): string => p.replaceAll('\\', '/').split('/(frontend)/')[1] ?? p
const read = (p: string): string => readFileSync(p, 'utf8')

// Исключений нет: и `/parent`, и `/chat` обязаны звать гейт. Экран согласия и отзыв
// согласия лежат ВНЕ этих деревьев (onboarding/, account/), поэтому под обход не
// попадают: иначе родитель не смог бы ни подписать, ни отозвать согласие — гейт
// зациклил бы его. Если добавишь исключение, оно обязано объяснять, почему.
const EXEMPT = new Set<string>()

describe('родительская поверхность закрыта гейтом согласия', () => {
  it('поверхность вообще нашлась (иначе гейт декоративен)', () => {
    expect(surface.length).toBeGreaterThanOrEqual(18)
  })

  it.each(surface.map((p) => [rel(p), p] as const))(
    '%s: зовёт гейт согласия',
    (_name, file) => {
      const name = rel(file)
      if (EXEMPT.has(name)) return
      const code = read(file)
      expect(
        code,
        `${name}: нет вызова гейта согласия (requireConsentPage / consentRequiredResponse). ` +
          'Родитель без согласия получит данные ребёнка этим экраном или этим роутом.',
      ).toMatch(/requireConsentPage|consentRequiredResponse/)
    },
  )

  it.each(surface.map((p) => [rel(p), p] as const))(
    '%s: гейт стоит ПОСЛЕ проверки пользователя (иначе проверяем null)',
    (_name, file) => {
      const name = rel(file)
      if (EXEMPT.has(name)) return
      const code = read(file)
      const gate = code.search(/await (requireConsentPage|consentRequiredResponse)/)
      const auth = code.search(/payload\.auth\(/)
      expect(auth).toBeGreaterThan(-1)
      expect(gate, `${name}: гейт вызывается до payload.auth`).toBeGreaterThan(auth)
    },
  )

  it('onboarding/consent и отзыв согласия остались без гейта — иначе цикл', () => {
    // Отзыв согласия обязан работать без согласия (родитель его и отзывает).
    const withdraw = fileURLToPath(
      new URL('../app/(frontend)/account/consent-withdraw/route.ts', import.meta.url),
    )
    expect(existsSync(withdraw)).toBe(true)
    expect(read(withdraw)).not.toMatch(/requireConsentPage|consentRequiredResponse/)
  })
})

describe('REST-гейт на коллекциях с данными ребёнка', () => {
  // Имя коллекции → файл: не все коллекции лежат в одноимённом файле (PaymentMessages
  // определён в PaymentThreads.ts), и гейт обязан это знать, а не угадывать по имени.
  const COLLECTIONS: Record<string, string> = {
    Players: 'Players',
    TrainingSessions: 'TrainingSessions',
    Rsvps: 'Rsvps',
    Notifications: 'Notifications',
    Announcements: 'Announcements',
    ChildRegistrations: 'ChildRegistrations',
    Matches: 'Matches',
    MatchComments: 'MatchComments',
    Subscriptions: 'Subscriptions',
    PaymentThreads: 'PaymentThreads',
    PaymentMessages: 'PaymentThreads',
    Questions: 'Questions',
    QuestionMessages: 'QuestionMessages',
    ChatTopics: 'ChatTopics',
    ChatMessages: 'ChatMessages',
    ChatReads: 'ChatReads',
  }

  it.each(Object.entries(COLLECTIONS))(
    '%s: beforeOperation с гейтом согласия',
    (name, file) => {
      const path = fileURLToPath(new URL(`../collections/${file}.ts`, import.meta.url))
      expect(existsSync(path), `${file}.ts не найден`).toBe(true)
      expect(read(path), `${name}: нет beforeOperation: [denyParentWithoutConsent]`).toMatch(
        /beforeOperation:\s*\[denyParentWithoutConsent\]/,
      )
    },
  )

  it.each(['Users', 'Consents', 'Devices', 'LoginTokens', 'LegalSignatures'])(
    '%s: гейта НЕТ — свои данные родителя и юридические записи остаются доступны',
    (name) => {
      const file = fileURLToPath(new URL(`../collections/${name}.ts`, import.meta.url))
      // Особенно важно для Consents: иначе родитель не смог бы ни подписать, ни отозвать.
      expect(read(file), `${name}: гейт согласия здесь ломает саму возможность дать согласие`).not.toMatch(
        /denyParentWithoutConsent/,
      )
    },
  )
})