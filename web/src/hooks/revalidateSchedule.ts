import type { CollectionAfterChangeHook, CollectionAfterDeleteHook } from 'payload'

import type { TrainingSession } from '../payload-types'
import { safeRevalidatePath } from '../lib/safeRevalidate'

// On-demand ISR: любая правка/удаление сессии → обновить страницы, где отображается
// расписание (родительский inbox /parent — PR6, coverage тренера /coach — PR7). Эти
// маршруты ещё строятся; revalidatePath по несуществующему пути безвреден, проводку
// готовим заранее, чтобы данные были свежими сразу, как только страницы появятся.
//
// Не гейтим на «волну»: даже незначимая правка (заметка, новая сессия) меняет то, что
// видно в расписании, → его стоит ревалидировать. Уважаем context.disableRevalidate
// (служебные операции/тесты), как в Sabantuy/GONBA.
const revalidateSchedulePaths = () => {
  safeRevalidatePath('/parent')
  safeRevalidatePath('/coach')
}

export const revalidateSchedule: CollectionAfterChangeHook<TrainingSession> = ({ doc, req: { context } }) => {
  if (!(context as Record<string, unknown>).disableRevalidate) revalidateSchedulePaths()
  return doc
}

export const revalidateScheduleDelete: CollectionAfterDeleteHook<TrainingSession> = ({ doc, req: { context } }) => {
  if (!(context as Record<string, unknown>).disableRevalidate) revalidateSchedulePaths()
  return doc
}
