import { normalizeSpaces } from './import/parsePlayersCsv'

// Бэклог-приёмки п.11: подтверждение заявки создавало нового `players` без сверки
// с уже существующим ребёнком — тот же ребёнок, заведённый импортом (или привязанный
// к родителю по ссылке-приглашению), задваивался: один ряд с группой, второй без.
//
// Здесь только решение (чистая функция, без payload): кого считать тем же ребёнком
// и что дописать существующему ряду. Маршрут остаётся тонким: он делает I/O.
//
// Ключ сверки — тот же, что у импорта (`playerKey` в lib/import/importPlayers.ts):
// нормализованное имя. Дополнительно:
//   * `account` ребёнка уникален в схеме — совпадение account сильнее имени;
//   * дата рождения сужает только когда она ЕСТЬ у обеих записей (импорт её не
//     ставит, и «у импортированного нет ДР» не должно мешать склейке);
//   * группа из заявки НЕ перетирается: у импортированного ребёнка она уже есть,
//     и это его настоящее место, а не пустое поле.

type ChildRecord = {
  name: string
  dateOfBirth?: string | null
  accountId?: number | null
  branchId?: number | null
}

export type ExistingChild = ChildRecord & { id: number }

export type IncomingChild = ChildRecord

const day = (v?: string | null): string | null => {
  if (!v) return null
  const d = new Date(v)
  return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10)
}

export const sameChildName = (a: string, b: string): boolean =>
  normalizeSpaces(a).toLowerCase() === normalizeSpaces(b).toLowerCase()

// Существующий ребёнок того же родителя, которым эта заявка является, или null.
// Список `existing` маршрут заранее сужает до детей ЭТОГО родителя: чужих не смотрим
// (152-ФЗ и #015 — родитель видит только своих).
export const findDuplicateChild = (
  existing: ExistingChild[],
  incoming: IncomingChild,
): ExistingChild | null => {
  if (incoming.accountId != null) {
    const byAccount = existing.find((p) => p.accountId === incoming.accountId)
    if (byAccount) return byAccount
  }
  const incomingDob = day(incoming.dateOfBirth)
  for (const candidate of existing) {
    if (!sameChildName(candidate.name, incoming.name)) continue
    const candidateDob = day(candidate.dateOfBirth)
    // Оба дня рождения известны и различаются → это разные дети с одинаковым именем.
    if (incomingDob && candidateDob && incomingDob !== candidateDob) continue
    return candidate
  }
  return null
}

// Что дописать существующему ребёнку вместо создания второго. Пустой объект =
// писать нечего. Ни одно ЗАПОЛНЕННОЕ поле не перетирается: заявка дополняет
// импортированный ряд, а не переписывает его.
export const dedupFill = (
  target: ExistingChild,
  incoming: IncomingChild,
  accountTaken: boolean,
): { account?: number; dateOfBirth?: string; branch?: number } => {
  const fill: { account?: number; dateOfBirth?: string; branch?: number } = {}
  if (incoming.accountId != null && target.accountId == null && !accountTaken) {
    fill.account = incoming.accountId
  }
  if (incoming.dateOfBirth && !target.dateOfBirth) {
    fill.dateOfBirth = incoming.dateOfBirth
  }
  if (incoming.branchId != null && target.branchId == null) {
    fill.branch = incoming.branchId
  }
  return fill
}
