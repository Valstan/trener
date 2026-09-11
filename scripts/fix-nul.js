#!/usr/bin/env node
// Проверка и чистка NUL-байтов в текстовых файлах (грабля харнесса на Windows).
//
// Обрыв записи может оставить в файле лишний NUL-байт или UTF-16/BOM — git тогда
// показывает исходник как `Bin` в `git diff --cached --stat`, хотя сборка может
// «проглотить». Симптом ловится так:
//
//     git add -A && git diff --cached --stat     # любой исходник как "Bin" → сюда
//
// Проверить (ничего не меняет):   node scripts/fix-nul.js <путь> [<путь>...]
// Проверить и вычистить:          node scripts/fix-nul.js --fix <путь> [<путь>...]
//
// Живёт файлом, а не однострочником в команде: текст с кавычками и не-ASCII внутри
// командной строки проходит до четырёх парсеров и ломается на любом из них (D-046).

const fs = require('fs')

const args = process.argv.slice(2)
const fix = args.includes('--fix')
const files = args.filter((a) => a !== '--fix')

if (files.length === 0) {
  console.error('usage: node scripts/fix-nul.js [--fix] <файл> [<файл>...]')
  process.exit(2)
}

let dirty = 0

for (const file of files) {
  let buf
  try {
    buf = fs.readFileSync(file)
  } catch (err) {
    console.error(`${file}: не прочитан — ${err.message}`)
    process.exitCode = 2
    continue
  }

  const nulCount = buf.filter((byte) => byte === 0).length

  let utf8Ok = true
  try {
    new TextDecoder('utf-8', { fatal: true }).decode(buf)
  } catch {
    utf8Ok = false
  }

  const verdict = nulCount === 0 && utf8Ok ? 'чисто' : 'ПОДОЗРЕНИЕ'
  console.log(`${file}: NUL=${nulCount} utf8=${utf8Ok ? 'да' : 'нет'} — ${verdict}`)

  if (nulCount === 0) continue
  dirty++

  if (fix) {
    fs.writeFileSync(file, Buffer.from(buf.filter((byte) => byte !== 0)))
    console.log(`${file}: вычищено ${nulCount} NUL-байт, пересохранён UTF-8`)
  }
}

// Без --fix найденная грязь должна валить вызывающий скрипт, а не проходить молча.
if (dirty > 0 && !fix) {
  console.error(`Найдено файлов с NUL: ${dirty}. Перезапусти с --fix, чтобы вычистить.`)
  process.exitCode = 1
}
