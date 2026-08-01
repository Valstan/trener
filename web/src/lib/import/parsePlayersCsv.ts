// Разбор вставленного из Excel списка детей (п.6 аудита: массовый импорт).
// Чистый модуль без payload — работает и на клиенте (предпросмотр файла в форме),
// и на сервере (preview/apply в /coach/import). Три колонки: имя, группа, email
// родителя (опционально). Всё лишнее отбрасывается ЗДЕСЬ — 152-ФЗ-минимизация:
// даже если директор вставил таблицу с датами рождения, дальше парсера они не уходят.

// Лимиты запроса (§3 дизайна): предпросмотр — целиком, применение — чанками.
export const MAX_IMPORT_TEXT_BYTES = 128 * 1024
export const APPLY_ROW_LIMIT = 50
const MAX_ROWS = 400
const MAX_NAME = 100 // лимит поля players.name

// Тот же нестрогий regex, что в staffInvite.ts: мусор не пускаем, настоящая
// проверка адреса — само письмо. Кривой email — warning, а не ошибка строки.
export const looksLikeEmail = (v: string): boolean => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)

// trim + схлопывание пробелов: «  Иванов   Пётр » → «Иванов Пётр». Та же
// нормализация (плюс lower) — в ключах дедупа здесь и в importPlayers.
export const normalizeSpaces = (v: string): string => v.replace(/\s+/g, ' ').trim()

type CsvRowWarning = 'email-invalid' | 'extra-columns'

export type PlayersCsvRow = {
  // Номер строки в исходном тексте (1-based, включая заголовок и пустые) —
  // совпадает с тем, что пользователь видит в Excel/редакторе.
  n: number
  name: string
  groupName: string
  email?: string
  errorCode?: 'name-empty' | 'name-long' | 'group-empty' | 'duplicate'
  duplicateOf?: number
  warnings: CsvRowWarning[]
}

type ParsePlayersCsvResult =
  | { ok: true; rows: PlayersCsvRow[] }
  | { ok: false; errorCode: 'too-many-rows' | 'delimiter' }

// Минимальный RFC 4180: поле в кавычках может содержать разделитель, `""` — кавычка.
// Excel сам квотит поля с разделителем внутри («"Иванов; Пётр";Группа»).
const splitLine = (line: string, delim: string): string[] => {
  const out: string[] = []
  let cur = ''
  let quoted = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (quoted) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"'
          i++
        } else quoted = false
      } else cur += ch
    } else if (ch === '"' && cur === '') {
      quoted = true
    } else if (ch === delim) {
      out.push(cur)
      cur = ''
    } else cur += ch
  }
  out.push(cur)
  return out
}

// Заголовок распознаём по словам — это позволяет произвольный порядок колонок.
const NAME_HEAD = /имя|ребён|фио/i
const GROUP_HEAD = /групп/i
const EMAIL_HEAD = /e-?mail|почт/i

export const parsePlayersCsv = (text: string): ParsePlayersCsvResult => {
  // Детект разделителя по приоритету TAB → «;» → «,» (§1): копипаста из Excel —
  // это TSV, русский Excel сохраняет CSV через «;». Запятую принимаем только как
  // последний вариант — и только если разбор не даёт лишних колонок (иначе
  // невозможно отличить запятую-разделитель от запятой в ФИО).
  const delim = text.includes('\t') ? '\t' : text.includes(';') ? ';' : ','

  const lines = text.replace(/\r\n?/g, '\n').split('\n')

  // Первая непустая строка — кандидат в заголовок: мапим колонки по словам.
  let nameIdx = 0
  let groupIdx = 1
  let emailIdx = 2
  let headerLine = -1
  for (let i = 0; i < lines.length; i++) {
    if (!lines[i].trim()) continue
    const fields = splitLine(lines[i], delim)
    const nameAt = fields.findIndex((f) => NAME_HEAD.test(f))
    const groupAt = fields.findIndex((f) => GROUP_HEAD.test(f))
    if (nameAt >= 0 && groupAt >= 0) {
      nameIdx = nameAt
      groupIdx = groupAt
      emailIdx = fields.findIndex((f) => EMAIL_HEAD.test(f))
      headerLine = i
    }
    break
  }

  const rows: PlayersCsvRow[] = []
  // Ключ дедупа = нормализованные имя+группа (lower): «ИВАНОВ пётр» = «Иванов Пётр».
  const seenAt = new Map<string, number>()

  for (let i = 0; i < lines.length; i++) {
    if (i === headerLine || !lines[i].trim()) continue
    if (rows.length >= MAX_ROWS) return { ok: false, errorCode: 'too-many-rows' }

    const fields = splitLine(lines[i], delim)
    // Запятая-разделитель дала >3 колонок → почти наверняка запятые в ФИО (§1).
    if (delim === ',' && fields.length > 3) return { ok: false, errorCode: 'delimiter' }

    const n = i + 1
    const warnings: CsvRowWarning[] = []
    const name = normalizeSpaces(fields[nameIdx] ?? '')
    const groupName = normalizeSpaces(fields[groupIdx] ?? '')

    // Колонки сверх трёх известных не сохраняются НИГДЕ (152-ФЗ) — только warning.
    const known = new Set([nameIdx, groupIdx, emailIdx])
    if (fields.some((f, idx) => !known.has(idx) && f.trim() !== '')) warnings.push('extra-columns')

    let email: string | undefined
    const emailRaw = emailIdx >= 0 ? (fields[emailIdx] ?? '').trim().toLowerCase() : ''
    if (emailRaw) {
      if (looksLikeEmail(emailRaw)) email = emailRaw
      else warnings.push('email-invalid') // строка НЕ падает: ребёнок создастся, письмо не шлём
    }

    const row: PlayersCsvRow = { n, name, groupName, email, warnings }
    if (!name) row.errorCode = 'name-empty'
    else if (name.length > MAX_NAME) row.errorCode = 'name-long'
    else if (!groupName) row.errorCode = 'group-empty'
    else {
      const key = `${name.toLowerCase()}\u0000${groupName.toLowerCase()}`
      const firstAt = seenAt.get(key)
      if (firstAt !== undefined) {
        row.errorCode = 'duplicate'
        row.duplicateOf = firstAt
      } else seenAt.set(key, n)
    }
    rows.push(row)
  }

  return { ok: true, rows }
}

// Декодирование загруженного .csv-файла НА КЛИЕНТЕ (сервер всегда получает UTF-8).
// Windows-реальность: Excel любит cp1251. Сначала строгий UTF-8, при ошибке —
// windows-1251; BOM срезаем.
export const decodeCsvBuffer = (buf: ArrayBuffer | Uint8Array): string => {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf)
  let text: string
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(bytes)
  } catch {
    text = new TextDecoder('windows-1251').decode(bytes)
  }
  return text.replace(/^\uFEFF/, '')
}
