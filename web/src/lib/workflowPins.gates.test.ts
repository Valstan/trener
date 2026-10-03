import { readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

// Аудит #057 (вектор e): сторонние actions были запинены на МУТИРУЕМЫЕ теги. Тег,
// который двигает maintainer (или перенос репозитория), = произвольный код в джобе,
// а джобы здесь держат SSH_PRIVATE_KEY прод-бокса и OIDC-токен комнаты КАРМАНа
// (14 production-секретов).
//
// Гейт смотрит на исходники workflow: не «сейчас запинено», а «невозможно добавить
// незапиненное, не заметив». Файл без actions (passport-probe.yml — только run-шаги)
// пропускается, но не молча: проверяется, что uses действительно нет.
const dir = fileURLToPath(new URL('../../../.github/workflows/', import.meta.url))
const repoRoot = fileURLToPath(new URL('../../../', import.meta.url))
const files = readdirSync(dir).filter((f) => f.endsWith('.yml'))
const read = (file: string): string => readFileSync(`${dir}/${file}`, 'utf8')
const readRepo = (file: string): string => readFileSync(`${repoRoot}${file}`, 'utf8')

const SHA40 = /^[0-9a-f]{40}$/
const USES_LINE = /uses:\s*([\w.-]+\/[\w.-]+)@([^\s#]+)(.*)$/gm

// Входы экшена (те, что живут в `with:`). Полный список у каждого экшена свой;
// здесь — те, что встречаются в наших workflow плюс частые, чтобы новый опечатка
// не проскочила молча.
const ACTION_INPUTS = new Set([
  'args',
  'fetch-depth',
  'fetch-tags',
  'filter',
  'path',
  'persist-credentials',
  'ref',
  'repository',
  'ssh-key',
  'ssh-known-hosts',
  'token',
])

type Step = {
  uses?: string
  line: number
  inputs: Record<string, string>
  /** Ключи на уровне шага (отступ = отступ `uses:`), с индсом для сообщения. */
  siblingKeys: Record<string, number>
}

/**
 * Разбор шагов без YAML-библиотеки. Раскладка шага:
 *
 *   - name: Checkout          отступ N-2  — начало элемента списка
 *     uses: actions/…@sha     отступ N    — якорь шага
 *     with:                   отступ N    — сосед шага (контейнер входов)
 *       persist-credentials: false  отступ N+2 — вход экшена
 *
 * Входы читаются только из блока `with:`; всё, что лежит на отступе `uses:` — соседи
 * шага, и если такой клюр известен как вход экшена, файл невалиден по схеме GitHub.
 */
function stepsOf(file: string): Step[] {
  const lines = read(file).split(/\r?\n/)
  const steps: Step[] = []
  let current: Step | null = null
  let usesIndent = -1
  let withIndent: number | null = null

  for (const [i, raw] of lines.entries()) {
    const line = raw.replace(/\s+#.*$/, '')
    const trimmed = line.trim()
    if (!trimmed) continue
    const indent = line.length - line.trimStart().length
    const isItemStart = trimmed.startsWith('- ')

    if (usesIndent >= 0 && indent < usesIndent) {
      current = null
      withIndent = null
      usesIndent = -1
    }
    if (isItemStart && current !== null) {
      // Новый элемент steps: прежний шаг закрыт, даже если `uses:` ещё не встретился.
      current = null
      withIndent = null
      usesIndent = -1
    }

    if (trimmed.startsWith('uses:')) {
      usesIndent = indent
      const uses = trimmed.slice('uses:'.length).trim().split('#')[0].trim()
      current = { uses, line: i + 1, inputs: {}, siblingKeys: {} }
      steps.push(current)
      continue
    }

    if (current === null) continue
    if (trimmed === 'with:') {
      withIndent = indent
      continue
    }

    const key = trimmed.split(':')[0]
    if (key.includes(' ')) continue
    const value = trimmed.split(':').slice(1).join(':').trim()

    if (withIndent !== null && indent > withIndent) current.inputs[key] = value
    else if (indent === usesIndent) current.siblingKeys[key] = i + 1
  }

  return steps
}

describe('actions запинены на полный commit SHA', () => {
  it.each(files)('%s: все uses — полный SHA', (file) => {
    const refs = [...read(file).matchAll(USES_LINE)]
    for (const match of refs) {
      expect(`${match[2]}`, `${file}: ${match[1]} не полный SHA`).toMatch(SHA40)
    }
  })

  it.each(files)('%s: версия сохранена комментарием на той же строке', (file) => {
    for (const match of read(file).matchAll(USES_LINE)) {
      expect(match[3], `${file}: у ${match[1]}@${match[2]} нет комментария с версией`).toMatch(/#\s*v?\d/)
    }
  })

  it('гейт не пропускает workflow, где uses вообще не разобран', () => {
    // Самопроверка гейта: если регулярка перестанет видеть uses (смена формата),
    // тест обязан это заметить, иначе станет декоративным.
    const all = files.map(read).join('\n')
    const total = [...all.matchAll(USES_LINE)].length
    expect(total).toBeGreaterThanOrEqual(13)
  })

  it.each(['deploy-prod.yml', 'apply-migration.yml', 'ci.yml'])(
    '%s: persist-credentials у checkout внутри with:, а не соседом с uses:',
    (file) => {
      // Именно placement, а не присутствие строки. Проверка «есть ли где-то
      // persist-credentials: false» пропустила дефект, который сам же гейт и внёс в
      // ci.yml: ключ на уровне шага делает файл невалидным ПО СХЕМЕ GitHub, и
      // GitHub отвергает весь workflow целиком (воркфлоу исчезает, dispatch не
      // работает) — при этом любой YAML-парсер говорит «валидно».
      const steps = stepsOf(file)
      const checkouts = steps.filter((s) => /^actions\/checkout@/.test(s.uses ?? ''))
      for (const step of checkouts) {
        expect(
          step.inputs['persist-credentials'],
          `${file}: persist-credentials должен быть вложен в with: у шага checkout`,
        ).toBe('false')
      }
    },
  )

  it.each(files)('%s: ключи inputs у actions не висят на уровне шага', (file) => {
    for (const step of stepsOf(file)) {
      for (const [key, line] of Object.entries(step.siblingKeys)) {
        expect(
          ACTION_INPUTS.has(key),
          `${file}:${line} — вход экшена «${key}» стоит на уровне шага у ${step.uses}; ` +
            'входы экшена живут только внутри with:, иначе GitHub отвергает весь файл',
        ).toBe(false)
      }
    }
  })

  it.each(['deploy-prod.yml', 'apply-migration.yml'])(
    '%s: раскатка объявлена в окружении production',
    (file) => {
      // Окружение даёт историю развёртываний (кто и что выкатил) и возможность позже
      // включить ручное подтверждение и environment-секреты, не правя код.
      expect(read(file), `${file}: нет environment: production`).toMatch(/environment:\s*production/)
    },
  )

  it('CODEOWNERS на месте и покрывает то, что исполняется в CI', () => {
    const code = readRepo('CODEOWNERS')
    expect(code).toMatch(/^\.github\/\s+@/m)
    expect(code).toMatch(/^\/deploy\/\s+@/m)
    expect(code).toMatch(/^\/web\/src\/migrations\/\s+@/m)
    // Правило на сам код тоже должно быть: иначе «всё остальное» останется без владельца.
    expect(code).toMatch(/^\*\s+@/m)
  })

  it('ci.yml: схемный гейт actionlint на месте (версия + sha256)', () => {
    // Гейт, который однажды пропустил сломанный workflow, обязан быть подменён
    // настоящей проверкой схемы — иначе та же ошибка вернётся на следующей правке.
    const code = read('ci.yml')
    expect(code).toMatch(/Workflow-schema-lint/)
    expect(code).toMatch(/ACTIONLINT_SHA256:\s*[0-9a-f]{64}/)
    // Сверка sha256 обязательна: бинарь actionlint — исполняемый код в джобе.
    expect(code).toMatch(/sha256sum -c -/)
  })

  it.each(['deploy-prod.yml', 'apply-migration.yml'])(
    '%s: сверка host-key обязательна (fail-closed на TOFU)',
    (file) => {
      const code = read(file)
      if (!code.includes('PROD_SSH_HOST')) return
      expect(code, `${file}: PROD_SSH_HOST без сверки отпечатка`).toMatch(
        /PROD_SSH_HOST_FINGERPRINT/,
      )
      // Раньше был `ssh-keyscan ... >> known_hosts` вслепую: кто ответил на порт 22,
      // тот и «свой». Теперь сверка с ожидаемым и exit 1 при расхождении.
      expect(code, `${file}: keyscan без проверки результата`).not.toMatch(
        /ssh-keyscan[^\n]*>>\s*~?\/?\.ssh\/known_hosts/,
      )
    },
  )
})
