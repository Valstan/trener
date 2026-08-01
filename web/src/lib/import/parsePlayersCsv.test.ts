import { describe, expect, it } from 'vitest'

import type { PlayersCsvRow } from './parsePlayersCsv'
import { decodeCsvBuffer, parsePlayersCsv } from './parsePlayersCsv'

// Достаём строки из успешного разбора; глобальная ошибка здесь — провал теста.
const rowsOf = (text: string): PlayersCsvRow[] => {
  const r = parsePlayersCsv(text)
  if (!r.ok) throw new Error(`ожидали ok, получили ${r.errorCode}`)
  return r.rows
}

describe('parsePlayersCsv — детект разделителя', () => {
  it('TSV (копипаста из Excel): три колонки', () => {
    const [r] = rowsOf('Иванов Пётр\tСтаршая\tpapa@mail.ru')
    expect(r).toMatchObject({ name: 'Иванов Пётр', groupName: 'Старшая', email: 'papa@mail.ru' })
    expect(r.errorCode).toBeUndefined()
  })

  it('«;» (русский Excel): запятая в ФИО остаётся одним полем', () => {
    const [r] = rowsOf('Иванова, Мария;Старшая')
    expect(r.name).toBe('Иванова, Мария')
    expect(r.groupName).toBe('Старшая')
  })

  it('приоритет TAB над «;», когда есть оба', () => {
    const [r] = rowsOf('Иванов; Пётр\tСтаршая')
    expect(r.name).toBe('Иванов; Пётр')
    expect(r.groupName).toBe('Старшая')
  })

  it('запятая-разделитель принимается, пока ≤3 колонок', () => {
    const [r] = rowsOf('Иванов Пётр,Старшая,a@b.ru')
    expect(r).toMatchObject({ name: 'Иванов Пётр', groupName: 'Старшая', email: 'a@b.ru' })
  })

  it('запятая-разделитель + запятая в ФИО → глобальная ошибка delimiter', () => {
    expect(parsePlayersCsv('Иванова, Мария,Старшая,a@b.ru')).toEqual({
      ok: false,
      errorCode: 'delimiter',
    })
  })
})

describe('parsePlayersCsv — кавычки (RFC 4180)', () => {
  it('«"Иванов; Пётр";Группа» → разделитель внутри кавычек не режет поле', () => {
    const [r] = rowsOf('"Иванов; Пётр";Старшая')
    expect(r.name).toBe('Иванов; Пётр')
    expect(r.groupName).toBe('Старшая')
  })

  it('удвоенная кавычка внутри кавычек → одна кавычка', () => {
    const [r] = rowsOf('"Пётр ""Малой""";Старшая')
    expect(r.name).toBe('Пётр "Малой"')
  })
})

describe('parsePlayersCsv — заголовок', () => {
  it('распознаётся по словам и не попадает в данные', () => {
    const rows = rowsOf('Имя ребёнка;Группа;Email родителя\nИванов;Старшая;a@b.ru')
    expect(rows).toHaveLength(1)
    expect(rows[0].name).toBe('Иванов')
  })

  it('произвольный порядок колонок мапится по заголовку', () => {
    const rows = rowsOf('Группа;Почта;ФИО\nСтаршая;a@b.ru;Иванов Пётр')
    expect(rows[0]).toMatchObject({ name: 'Иванов Пётр', groupName: 'Старшая', email: 'a@b.ru' })
  })

  it('без заголовка первая строка — данные', () => {
    const rows = rowsOf('Иванов;Старшая\nПетров;Младшая')
    expect(rows).toHaveLength(2)
    expect(rows[0].name).toBe('Иванов')
  })
})

describe('parsePlayersCsv — нормализация и валидация строк', () => {
  it('trim, двойные пробелы, CRLF, пустые строки', () => {
    const rows = rowsOf('  Иванов   Пётр  ;Старшая\r\n\r\n Петров Вася ; Младшая \r\n')
    expect(rows).toHaveLength(2)
    expect(rows[0].name).toBe('Иванов Пётр')
    expect(rows[1]).toMatchObject({ name: 'Петров Вася', groupName: 'Младшая' })
  })

  it('пустое имя / имя 101 символ / пустая группа → коды ошибок', () => {
    const rows = rowsOf(`;Старшая\n${'и'.repeat(101)};Старшая\nПетров;`)
    expect(rows.map((r) => r.errorCode)).toEqual(['name-empty', 'name-long', 'group-empty'])
  })

  it('401-я строка → глобальная ошибка too-many-rows', () => {
    const text = Array.from({ length: 401 }, (_, i) => `Ребёнок ${i};Старшая`).join('\n')
    expect(parsePlayersCsv(text)).toEqual({ ok: false, errorCode: 'too-many-rows' })
    // ровно 400 — ещё ок
    const ok = parsePlayersCsv(Array.from({ length: 400 }, (_, i) => `Ребёнок ${i};Старшая`).join('\n'))
    expect(ok.ok).toBe(true)
  })

  it('email: валидный нормализуется, кривой — warning (строка НЕ падает), пустой — тишина', () => {
    const rows = rowsOf('Иванов;Старшая;PAPA@Mail.RU\nПетров;Старшая;без-собаки\nСидоров;Старшая;')
    expect(rows[0].email).toBe('papa@mail.ru')
    expect(rows[1].email).toBeUndefined()
    expect(rows[1].errorCode).toBeUndefined()
    expect(rows[1].warnings).toContain('email-invalid')
    expect(rows[2].email).toBeUndefined()
    expect(rows[2].warnings).toEqual([])
  })

  it('дубль внутри файла с учётом нормализации: «ИВАНОВ пётр» = «Иванов Пётр»', () => {
    const rows = rowsOf('Иванов Пётр;Старшая\nИВАНОВ  пётр;старшая')
    expect(rows[0].errorCode).toBeUndefined()
    expect(rows[1].errorCode).toBe('duplicate')
    expect(rows[1].duplicateOf).toBe(1)
  })

  it('лишние колонки → warning, а их данных в результате НЕТ (152-ФЗ)', () => {
    const rows = rowsOf('Иванов;Старшая;a@b.ru;2015-05-01;СНИЛС 123')
    expect(rows[0].warnings).toContain('extra-columns')
    expect(JSON.stringify(rows)).not.toContain('2015-05-01')
    expect(JSON.stringify(rows)).not.toContain('СНИЛС')
  })
})

describe('decodeCsvBuffer — кодировки Windows-реальности', () => {
  it('UTF-8 как есть', () => {
    expect(decodeCsvBuffer(new TextEncoder().encode('Иванов;Старшая'))).toBe('Иванов;Старшая')
  })

  it('UTF-8 с BOM — BOM срезается', () => {
    const body = new TextEncoder().encode('Иванов;Старшая')
    const buf = new Uint8Array([0xef, 0xbb, 0xbf, ...body])
    expect(decodeCsvBuffer(buf)).toBe('Иванов;Старшая')
  })

  it('windows-1251 («Иванов Пётр;Старшая» в cp1251-байтах) → корректная строка', () => {
    // И=0xC8 в=0xE2 а=0xE0 н=0xED о=0xEE в=0xE2 ␣ П=0xCF ё=0xB8 т=0xF2 р=0xF0 ;
    // С=0xD1 т=0xF2 а=0xE0 р=0xF0 ш=0xF8 а=0xE0 я=0xFF
    const cp1251 = new Uint8Array([
      0xc8, 0xe2, 0xe0, 0xed, 0xee, 0xe2, 0x20, 0xcf, 0xb8, 0xf2, 0xf0, 0x3b, 0xd1, 0xf2, 0xe0,
      0xf0, 0xf8, 0xe0, 0xff,
    ])
    expect(decodeCsvBuffer(cp1251)).toBe('Иванов Пётр;Старшая')
  })
})
