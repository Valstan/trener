// Разбор/валидация входа фронтового composer'а расписания (/coach/session).
// Create заводит planned-тренировку (не волна); patch правит дату/место/заметку или
// отменяет — волну и diff дальше делает ядро M2 (trackSessionChange → fanOut).

const MAX_LOCATION = 200
const MAX_NOTE = 500

const parseDate = (v: unknown): string | null => {
  if (typeof v !== 'string' || !v || Number.isNaN(Date.parse(v))) return null
  return new Date(v).toISOString()
}

const parseText = (v: unknown, max: number): string | undefined => {
  if (typeof v !== 'string') return undefined
  const t = v.trim()
  return t ? t.slice(0, max) : undefined
}

export type SessionCreateInput = {
  groupId: number
  startDate: string
  endDate?: string
  location?: string
  note?: string
}

// null → 400. endDate (если задан) должен быть позже startDate.
export const parseSessionCreate = (raw: unknown): SessionCreateInput | null => {
  if (typeof raw !== 'object' || raw === null) return null
  const r = raw as Record<string, unknown>
  const groupId = r.groupId
  const startDate = parseDate(r.startDate)
  if (typeof groupId !== 'number' || !Number.isInteger(groupId) || !startDate) return null

  const endDate = r.endDate == null || r.endDate === '' ? undefined : parseDate(r.endDate)
  if (r.endDate != null && r.endDate !== '' && !endDate) return null
  if (endDate && Date.parse(endDate) <= Date.parse(startDate)) return null

  return {
    groupId,
    startDate,
    endDate: endDate ?? undefined,
    location: parseText(r.location, MAX_LOCATION),
    note: parseText(r.note, MAX_NOTE),
  }
}

export type SessionPatchInput = {
  sessionId: number
  data: {
    startDate?: string
    endDate?: string | null
    location?: string | null
    note?: string | null
    status?: 'cancelled'
  }
}

// Patch частичный (C1-семантика diff-хука): поле попадает в data только если пришло.
// Пустая строка endDate/location/note = «очистить» (null). cancel:true → отмена.
export const parseSessionPatch = (raw: unknown): SessionPatchInput | null => {
  if (typeof raw !== 'object' || raw === null) return null
  const r = raw as Record<string, unknown>
  if (typeof r.sessionId !== 'number' || !Number.isInteger(r.sessionId)) return null

  const data: SessionPatchInput['data'] = {}

  if (r.startDate !== undefined) {
    const d = parseDate(r.startDate)
    if (!d) return null
    data.startDate = d
  }
  if (r.endDate !== undefined) {
    if (r.endDate === null || r.endDate === '') data.endDate = null
    else {
      const d = parseDate(r.endDate)
      if (!d) return null
      data.endDate = d
    }
  }
  if (data.startDate && data.endDate && Date.parse(data.endDate) <= Date.parse(data.startDate)) return null

  if (r.location !== undefined) data.location = parseText(r.location, MAX_LOCATION) ?? null
  if (r.note !== undefined) data.note = parseText(r.note, MAX_NOTE) ?? null
  if (r.cancel === true) data.status = 'cancelled'

  if (Object.keys(data).length === 0) return null // пустой патч — нечего делать
  return { sessionId: r.sessionId, data }
}
