import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

// Аудит #057 (вектор a, red-team): самый дешёвый способ стать владельцем прод-БД.
// Гейт был один — «таблица users пуста», а он выполним анонимным POST'ом.
// Приёмка — в первую очередь мутационная: возврат эндпоинта в тест должен ронять
// проверку (иначе гейт «благословит» себя, как было с canonical-гейтом #178).
const src = (rel: string): string =>
  readFileSync(fileURLToPath(new URL(`../${rel}`, import.meta.url)), 'utf8')

const USERS = 'collections/Users.ts'

describe('#057: анонимная регистрация первого owner закрыта', () => {
  it('Users объявляет перекрывающий endpoint /first-register', () => {
    expect(src(USERS)).toMatch(/endpoints:\s*\[blockFirstRegister\]/)
  })

  it('blockFirstRegister отвечает 403 и не делает ничего', () => {
    const guard = src('collections/firstRegisterGuard.ts')
    expect(guard).toMatch(/path:\s*'\/first-register'/)
    expect(guard).toMatch(/status:\s*403/)
  })

  it('PAYLOAD_SECRET без fallback — конфиг падает, а не подписывает токены пустым ключом', () => {
    const config = src('payload.config.ts')
    expect(config).not.toMatch(/secret:\s*process\.env\.PAYLOAD_SECRET\s*\|\|\s*''/)
    expect(config).toMatch(/PAYLOAD_SECRET не задан/)
  })

  it('телеметрия Payload выключена (неоговоренный выход наружу)', () => {
    expect(src('payload.config.ts')).toMatch(/telemetry:\s*false/)
  })

  it('session-cookie с Secure (дефолт Payload — secure:false)', () => {
    expect(src(USERS)).toMatch(/cookies:\s*\{\s*secure:\s*true/)
  })

  it('cron-секрет принимается только заголовком и сравнивается постоянного времени', () => {
    for (const rel of ['app/(frontend)/cron/rsvp-reminders/route.ts', 'app/(frontend)/cron/demo-reseed/route.ts']) {
      const code = src(rel)
      expect(code).toMatch(/timingSafeEqualStr\(provided, secret\)/)
      expect(code).not.toMatch(/searchParams\.get\('secret'\)/)
    }
  })

  it('IP журнала подписей берётся с конца x-forwarded-for', () => {
    expect(src('lib/requestMeta.ts')).toMatch(/chain\[chain\.length - 1\]/)
  })
})

describe('#057 вектор b: mass assignment через REST закрыт', () => {
  it.each([
    ['collections/Players.ts', 'group'],
    ['collections/Players.ts', 'branch'],
    ['collections/Players.ts', 'parent'],
    ['collections/TrainingSessions.ts', 'group'],
    ['collections/Matches.ts', 'group'],
  ])('%s: поле %s имеет field-access', (file, field) => {
    const code = src(file)
    // Вокруг имени поля должен идти блок access — иначе PATCH /api/<coll>:<id> перепишет
    // его из тела запроса (collection-access смотрит только на ТЕКУЩИЙ документ).
    const re = new RegExp(`name: '${field}'[\\s\\S]{0,320}?access: \\{`)
    expect(code).toMatch(re)
  })

  it('requestedRole недоступен на запись из REST (роль выбирает сервер)', () => {
    const code = src(USERS)
    const idx = code.indexOf("name: 'requestedRole'")
    expect(idx).toBeGreaterThan(-1)
    // Окно до следующего name: — комментарий между полем и access длинный.
    const block = code.slice(idx, code.indexOf("name: '", idx + 10))
    expect(block).toMatch(/access:\s*\{\s*create:\s*\(\)\s*=>\s*false/)
    expect(block).toMatch(/update:\s*\(\)\s*=>\s*false/)
  })

  it('Matches.create скоуплен по запрошенной группе (Г211 не применяется к create)', () => {
    expect(src('collections/Matches.ts')).toMatch(/create:\s*createInOwnGroup/)
  })

  it('заявитель (applicant/pending) не попадает в школьный чат', () => {
    expect(src('access/chatScope.ts')).toMatch(
      /!adminBranch && !isCoach\(user\) && !isParent\(user\)\) return false/,
    )
  })
})
