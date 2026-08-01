import type { Payload, Where } from 'payload'

import { adminBranchId, isCoach, isOwner } from '@/access/roles'
import { createInviteToken } from '@/lib/auth/invite'
import { sendPlayerJoinEmail } from '@/lib/email/magicLinkEmail'
import { relId } from '@/lib/relId'

import { looksLikeEmail, normalizeSpaces, parsePlayersCsv } from './parsePlayersCsv'

// Оркестратор массового импорта детей (п.6 аудита): белый список групп по роли,
// матчинг групп по имени, дедуп против БД, preview/apply, выпуск join-ссылок,
// письма. Создаёт ТОЛЬКО players (имя+группа) — родитель заводится сам через
// /join → /onboarding/consent, 152-ФЗ-согласие не обходится.

const serverBase = (): string =>
  (process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:3000').replace(/\/+$/, '')

// Роли берём структурно (как Roleish в access/roles) — lib тестируется мок-payload'ом.
type ImportUser = {
  id: number | string
  roles?: string[] | null
  branch?: { id: number | string } | number | string | null
}

type ScopeGroup = { id: number; name: string }
type ScopeError = { ok: false; errorCode: 'branch-required' | 'forbidden' }

const findScopeGroups = async (payload: Payload, where: Where): Promise<ScopeGroup[]> => {
  const res = await payload.find({
    collection: 'groups',
    where,
    depth: 0,
    limit: 1000,
    pagination: false,
    overrideAccess: true,
  })
  return res.docs.map((g) => ({ id: g.id, name: g.name }))
}

// Плоский белый список групп вызывающего (#015, G211 для этого маршрута):
// owner — группы выбранного филиала (branchId обязателен: имена групп могут
// повторяться между филиалами); branch-admin — только СВОЙ филиал, присланный
// чужой branchId отклоняем (fail-closed, как в createGroups); coach — свои группы.
// Служебные find'ы — overrideAccess: true, плоские условия (G90).
const resolveScope = async (
  payload: Payload,
  user: ImportUser,
  branchId: number | null | undefined,
): Promise<{ ok: true; groups: ScopeGroup[] } | ScopeError> => {
  if (isOwner(user)) {
    if (branchId == null) return { ok: false, errorCode: 'branch-required' }
    return { ok: true, groups: await findScopeGroups(payload, { branch: { equals: branchId } }) }
  }
  const myBranch = adminBranchId(user)
  if (myBranch != null) {
    if (branchId != null && String(branchId) !== String(myBranch)) {
      return { ok: false, errorCode: 'forbidden' }
    }
    return { ok: true, groups: await findScopeGroups(payload, { branch: { equals: myBranch } }) }
  }
  if (isCoach(user)) {
    return { ok: true, groups: await findScopeGroups(payload, { coaches: { in: [user.id] } }) }
  }
  return { ok: false, errorCode: 'forbidden' }
}

// Ключ идемпотентности: нормализованное имя + группа (unique-индексов у players нет).
const playerKey = (name: string, groupId: number | string): string =>
  `${normalizeSpaces(name).toLowerCase()}\u0000${groupId}`

// Один find на запрос (не по строке): существующие дети групп белого списка.
const loadExisting = async (
  payload: Payload,
  groupIds: number[],
): Promise<Map<string, { id: number; hasParent: boolean }>> => {
  const map = new Map<string, { id: number; hasParent: boolean }>()
  if (!groupIds.length) return map
  const res = await payload.find({
    collection: 'players',
    where: { group: { in: groupIds } },
    limit: 1000,
    pagination: false,
    depth: 0,
    overrideAccess: true,
  })
  for (const p of res.docs) {
    const gid = relId(p.group)
    if (gid == null) continue
    map.set(playerKey(p.name, gid), { id: p.id, hasParent: relId(p.parent) != null })
  }
  return map
}

type ImportRowStatus = 'create' | 'exists' | 'linked' | 'error'

export type ImportPreviewRow = {
  n: number
  name: string
  groupId: number | null
  groupName: string
  email?: string
  status: ImportRowStatus
  errorCode?: string
  duplicateOf?: number
  warnings: string[]
}

type ImportPreviewResult =
  | { ok: false; errorCode: 'too-many-rows' | 'delimiter' | 'branch-required' | 'forbidden' }
  | {
      ok: true
      rows: ImportPreviewRow[]
      summary: { create: number; exists: number; linked: number; errors: number }
    }

// Режим preview: парсинг + валидация + матчинг, ничего не пишет. Ошибочные строки
// не блокируют остальные — частичный успех норма (§2).
export const previewImport = async (
  payload: Payload,
  user: ImportUser,
  input: { text: string; branchId?: number | null },
): Promise<ImportPreviewResult> => {
  const scope = await resolveScope(payload, user, input.branchId)
  if (!scope.ok) return scope

  const parsed = parsePlayersCsv(input.text)
  if (!parsed.ok) return parsed

  // Матчинг группы по нормализованному имени. Два совпадения в скоупе → ошибка
  // строки ambiguous (автосоздания групп НЕТ — опечатка не должна рожать фантом, §4).
  const groupsByName = new Map<string, ScopeGroup[]>()
  for (const g of scope.groups) {
    const key = normalizeSpaces(g.name).toLowerCase()
    groupsByName.set(key, [...(groupsByName.get(key) ?? []), g])
  }
  const existing = await loadExisting(payload, scope.groups.map((g) => g.id))

  const rows: ImportPreviewRow[] = parsed.rows.map((r) => {
    const base = { ...r, groupId: null as number | null, status: 'error' as ImportRowStatus }
    if (r.errorCode) return base
    const matches = groupsByName.get(r.groupName.toLowerCase()) ?? []
    if (!matches.length) return { ...base, errorCode: 'group-not-found' }
    if (matches.length > 1) return { ...base, errorCode: 'group-ambiguous' }
    const group = matches[0]
    const ex = existing.get(playerKey(r.name, group.id))
    return {
      ...r,
      groupId: group.id,
      groupName: group.name,
      status: ex ? (ex.hasParent ? 'linked' : 'exists') : 'create',
    }
  })

  const count = (s: ImportRowStatus): number => rows.filter((r) => r.status === s).length
  return {
    ok: true,
    rows,
    summary: { create: count('create'), exists: count('exists'), linked: count('linked'), errors: count('error') },
  }
}

export type ImportApplyRowInput = { name?: unknown; groupId?: unknown; email?: unknown }

export type ImportApplyRow = {
  name: string
  groupName: string
  status: ImportRowStatus
  errorCode?: string
  joinUrl?: string
  emailStatus: 'sent' | 'failed' | 'none'
}

type ImportApplyResult =
  | { ok: false; errorCode: 'branch-required' | 'forbidden' }
  | {
      ok: true
      rows: ImportApplyRow[]
      summary: { created: number; links: number; reissued: number; emailsSent: number; errors: number }
    }

// Режим apply (чанк ≤50 строк с клиента). Каждая строка РЕ-валидируется: предпросмотр
// не является доверенным вводом, а между preview и apply мог пройти параллельный
// импорт (TOCTOU) — groupId сверяем с белым списком, дедуп считаем заново.
// Транзакций нет: упавшая строка → error в отчёте, остальные продолжаются.
export const applyImport = async (
  payload: Payload,
  user: ImportUser,
  input: { rows: ImportApplyRowInput[]; branchId?: number | null; sendEmails?: boolean },
): Promise<ImportApplyResult> => {
  const scope = await resolveScope(payload, user, input.branchId)
  if (!scope.ok) return scope

  const groupById = new Map(scope.groups.map((g) => [g.id, g]))
  const existing = await loadExisting(payload, scope.groups.map((g) => g.id))
  const seen = new Set<string>()

  const rows: ImportApplyRow[] = []
  const summary = { created: 0, links: 0, reissued: 0, emailsSent: 0, errors: 0 }
  const fail = (name: string, groupName: string, errorCode: string): void => {
    rows.push({ name, groupName, status: 'error', errorCode, emailStatus: 'none' })
    summary.errors++
  }

  for (const [i, raw] of input.rows.entries()) {
    const name = normalizeSpaces(typeof raw.name === 'string' ? raw.name : '')
    const groupId = typeof raw.groupId === 'number' ? raw.groupId : null
    const group = groupId != null ? groupById.get(groupId) : undefined

    if (!name) {
      fail(name, group?.name ?? '', 'name-empty')
      continue
    }
    if (name.length > 100) {
      fail(name, group?.name ?? '', 'name-long')
      continue
    }
    // Группа вне белого списка = ошибка строки, не падение запроса (§3).
    if (groupId == null || !group) {
      fail(name, '', 'group-not-found')
      continue
    }
    const key = playerKey(name, groupId)
    if (seen.has(key)) {
      fail(name, group.name, 'duplicate')
      continue
    }
    seen.add(key)

    const ex = existing.get(key)
    // Уже привязан к родителю → пропуск целиком, ссылку не перевыпускаем
    // (нечего приглашать — анти-переспам родителя).
    if (ex?.hasParent) {
      rows.push({ name, groupName: group.name, status: 'linked', emailStatus: 'none' })
      continue
    }

    const emailRaw = typeof raw.email === 'string' ? raw.email.trim().toLowerCase() : ''
    const email = looksLikeEmail(emailRaw) ? emailRaw : ''

    try {
      let playerId: number
      if (ex) {
        // Существует без родителя → НЕ создаём, но перевыпускаем join-ссылку:
        // повторный прогон того же CSV = способ восстановить потерянную таблицу.
        playerId = ex.id
      } else {
        // Право уже доказано сверкой группы против белого списка — это ЖЁСТЧЕ
        // булевого Players.access.create, поэтому overrideAccess. Ровно name+group,
        // email транзитный и в players не попадает НИКОГДА (152-ФЗ, §6).
        const created = await payload.create({
          collection: 'players',
          data: { name, group: groupId },
          overrideAccess: true,
        })
        playerId = created.id
      }

      const rawToken = await createInviteToken(payload, playerId)
      const joinUrl = `${serverBase()}/join/${rawToken}`

      let emailStatus: ImportApplyRow['emailStatus'] = 'none'
      if (input.sendEmails && email) {
        emailStatus = (await sendPlayerJoinEmail(payload, email, joinUrl, name)) ? 'sent' : 'failed'
        if (emailStatus === 'sent') summary.emailsSent++
      }

      rows.push({ name, groupName: group.name, status: ex ? 'exists' : 'create', joinUrl, emailStatus })
      summary.links++
      if (ex) summary.reissued++
      else summary.created++
    } catch (err) {
      // Логи без ПДн: номер строки и код, ни имени, ни email (§6).
      payload.logger.error(`[coach/import] строка ${i + 1}: create-failed (${(err as Error).message})`)
      fail(name, group.name, 'create-failed')
    }
  }

  return { ok: true, rows, summary }
}
