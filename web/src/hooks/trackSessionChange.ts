import type { CollectionBeforeChangeHook } from 'payload'

import type { TrainingSession } from '../payload-types'

// Сигнал beforeChange → afterChange: «произошла значимая правка расписания» (волна).
// Один проход хука = одна волна; фан-аут (afterChange) читает этот ключ из req.context.
export const SCHEDULE_WAVE_CONTEXT_KEY = 'scheduleChangeWave'

export type ScheduleChangeWave = {
  type: 'changed' | 'cancelled'
  changedAt: string
}

// Сравнение дат по МГНОВЕНИЮ: data может прийти как Date или ISO-строка иного формата
// (без мс, с/без Z), а originalDoc — строка из БД. Прямое !== давало бы ложную «правку».
const dateChanged = (a: unknown, b: unknown): boolean => {
  const ta = a == null ? null : new Date(a as string | number | Date).getTime()
  const tb = b == null ? null : new Date(b as string | number | Date).getTime()
  return ta !== tb
}

const valueChanged = (a: unknown, b: unknown): boolean => (a ?? null) !== (b ?? null)

// Diff-трекер тренировки (beforeChange). Заполняет служебные поля changedFields/
// changedAt/prev* и поднимает «волну» в req.context, ТОЛЬКО когда реально изменилось
// одно из значимых полей расписания (startDate/endDate/location/status). Заметка,
// прочие поля — не волна (granularity-гард, kickoff §6).
//
// C1 (критик M2): diff устойчив к ЧАСТИЧНОМУ патчу — поле учитывается только если
// пришло в data (`!== undefined`) И отличается от сохранённого originalDoc.
export const trackSessionChange: CollectionBeforeChangeHook<TrainingSession> = ({
  data,
  originalDoc,
  operation,
  req,
}) => {
  // Уведомляем об ИЗМЕНЕНИИ существующей сессии. Создание новой (planned) — не волна.
  if (operation !== 'update' || !originalDoc) return data

  const changed: string[] = []
  if (data.startDate !== undefined && dateChanged(data.startDate, originalDoc.startDate)) changed.push('startDate')
  if (data.endDate !== undefined && dateChanged(data.endDate, originalDoc.endDate)) changed.push('endDate')
  if (data.location !== undefined && valueChanged(data.location, originalDoc.location)) changed.push('location')
  if (data.status !== undefined && valueChanged(data.status, originalDoc.status)) changed.push('status')

  if (changed.length === 0) return data // незначимая правка — волну не поднимаем

  const effectiveStatus = (data.status ?? originalDoc.status) as TrainingSession['status']
  const type: ScheduleChangeWave['type'] = effectiveStatus === 'cancelled' ? 'cancelled' : 'changed'

  // Перенос (дата/место) при статусе 'planned' → авто-отражаем как 'changed', чтобы
  // список тренера и coverage читались правдиво, а тренер не помнил «флипнуть статус»
  // вторым шагом. Явный 'cancelled' не трогаем (он важнее переноса).
  const reschedule = changed.some((f) => f !== 'status')
  if (type === 'changed' && reschedule && effectiveStatus === 'planned') {
    data.status = 'changed'
    if (!changed.includes('status')) changed.push('status')
  }

  const changedAt = new Date().toISOString()
  data.changedFields = changed
  data.changedAt = changedAt
  data.prevStartDate = originalDoc.startDate ?? null
  data.prevLocation = originalDoc.location ?? null

  const ctx = req.context as Record<string, unknown>
  ctx[SCHEDULE_WAVE_CONTEXT_KEY] = { type, changedAt } satisfies ScheduleChangeWave
  return data
}
