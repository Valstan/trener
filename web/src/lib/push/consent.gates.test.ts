import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

// Аудит #057, вектор (f): доставка после отзыва согласия.
//
// Юнит-тесты доказывают поведение предиката, но не то, что предикат вообще
// ВЫЗЫВАЕТСЯ на пути отправки. А именно это и ломалось: проверка согласия была
// написана, проверена тестами — и не подключена ни к одному из 13 мест отправки.
// Гейт ниже читает исходники, поэтому «переименовали/вынесли/забыли вызвать» —
// красный тест, а не тихая регрессия 152-ФЗ.
const read = (rel: string): string =>
  readFileSync(fileURLToPath(new URL(rel, import.meta.url)), 'utf8')

const SEND = read('./send.ts')
const WITHDRAW = read('../../app/(frontend)/account/consent-withdraw/route.ts')

describe('пуш не уходит после отзыва согласия', () => {
  it('шлюз отправки спрашивает согласие адресата', () => {
    // Проверка на упоминание — грубая и обманывается `if (false && проверка)`, поэтому
    // настоящую защиту несёт поведенческий тест consentDelivery.test.ts: «доставки нет,
    // устройства не запрашивались». Этот тест ловит и выключатель, и перенос проверки
    // в конец функции; здесь же — чтобы выпили импорт молча нельзя было.
    expect(SEND, 'sendPushToUser обязан звать фильтр согласия').toMatch(/pushAllowedByConsent/)
    expect(SEND).toMatch(/countActiveConsents/)
  })

  it('фильтр согласия не выключается флагом (иначе гейт станет декоративным)', () => {
    expect(SEND).not.toMatch(/if\s*\(\s*(false|0|""|'')\s*(&&|\|\|)/)
    expect(SEND).not.toMatch(/(BYPASS|SKIP)_CONSENT/i)
  })

  it('отзыв согласия удаляет и push-подписки родителя', () => {
    // Defense-in-depth: фильтр держит шлюз, но endpoint подписки — тоже ПДн, и после
    // отзыва хранить их незачем. Без этого будущий sender, обошедший фильтр, продолжил бы
    // доставлять.
    expect(WITHDRAW).toMatch(/collection: 'devices'/)
    const delDevices = WITHDRAW.indexOf("collection: 'devices'")
    const delConsents = WITHDRAW.indexOf("collection: 'consents'")
    expect(delDevices).toBeGreaterThan(-1)
    expect(delConsents).toBeGreaterThan(-1)
  })

  it('в отзыве согласия удаление consents остаётся (иначе гейт согласия перестанет работать)', () => {
    // Регресс-ловушка: «заодно удалим и consents» без consents гейт перестаёт заводить
    // родителя на экран согласия — то есть система потеряет гейт вместо того, чтобы
    // закрыть доставку.
    expect(WITHDRAW).toMatch(/delete\(\{[\s\S]*collection: 'consents'/)
  })

  it('никто не «чинит» это флагом на конкретном сообщении молча', () => {
    // Если появится адресный обход (флаг «про ПДн ребёнка»), его место — решение
    // владельца: он меняет юридическую границу, а не технику. Здесь фиксируем, что
    // сегодня правило общее для адресата-родителя.
    expect(SEND).not.toMatch(/PUSH_ALLOWLIST|BYPASS_CONSENT/i)
  })
})