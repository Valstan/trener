// Разбор входа комнат чатов (M9): создание темы и отправка сообщения.
// Отдельным модулем — чтобы правила («тема не пустая», «сообщение режется по лимиту»)
// проверялись юнит-тестами, а не только руками через форму.

const MAX_TITLE = 120
const MAX_BODY = 2000

const parseId = (v: unknown): number | null =>
  typeof v === 'number' && Number.isInteger(v) && v > 0 ? v : null

// Схлопываем пробелы по краям и подряд идущие переводы строк: без этого «сообщение»
// из одних переносов проходит как непустое и ломает список тем пустой строкой.
const parseText = (v: unknown, max: number): string | null => {
  if (typeof v !== 'string') return null
  const t = v.replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim()
  return t ? t.slice(0, max) : null
}

export type TopicCreateInput = { groupId: number; title: string; room: 'adults' | 'children' }

export const parseTopicCreate = (raw: unknown): TopicCreateInput | null => {
  if (typeof raw !== 'object' || raw === null) return null
  const r = raw as Record<string, unknown>
  const groupId = parseId(r.groupId)
  const title = parseText(r.title, MAX_TITLE)
  if (groupId == null || title == null) return null
  const room = r.room === 'children' ? 'children' : 'adults'
  return { groupId, title, room }
}

export type MessageCreateInput = { topicId: number; body: string }

export const parseMessageCreate = (raw: unknown): MessageCreateInput | null => {
  if (typeof raw !== 'object' || raw === null) return null
  const r = raw as Record<string, unknown>
  const topicId = parseId(r.topicId)
  const body = parseText(r.body, MAX_BODY)
  if (topicId == null || body == null) return null
  return { topicId, body }
}
