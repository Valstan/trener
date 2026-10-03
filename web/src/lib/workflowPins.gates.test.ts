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
const files = readdirSync(dir).filter((f) => f.endsWith('.yml'))
const read = (file: string): string => readFileSync(`${dir}/${file}`, 'utf8')

const SHA40 = /^[0-9a-f]{40}$/
const USES_LINE = /uses:\s*([\w.-]+\/[\w.-]+)@([^\s#]+)(.*)$/gm

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
    '%s: checkout без persist-credentials — токен не лежит в .git/config',
    (file) => {
      const code = read(file)
      if (!code.includes('uses: actions/checkout@')) return
      expect(code, `${file}: checkout без persist-credentials: false`).toMatch(
        /persist-credentials:\s*false/,
      )
    },
  )

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
