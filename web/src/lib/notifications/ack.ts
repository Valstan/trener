// Чистое решение ack-перехода (критик M2 — M8): статус двигается ТОЛЬКО вперёд
// (delivered/seen → acked) и ТОЛЬКО владельцем. Логику стережёт эндпоинт /parent/ack,
// не field-access: эндпоинт грузит уведомление (overrideAccess), проверяет владение и
// текущий статус через эту функцию, затем делает overrideAccess-update. Прямой
// client-PATCH по коллекции закрыт (Notifications.update = adminOnly).
//
// Идемпотентность: повторный ack уже принятого → noop (ok, без перезаписи ackedAt).
// superseded (перекрыто новой волной) → reject 409: клиенту нужно перечитать inbox.

export type AckNotif = { parent: number | null; status: string }

export type AckOutcome =
  | { action: 'ack' } // delivered|seen → выставить acked
  | { action: 'noop' } // уже acked → идемпотентный ok
  | { action: 'reject'; status: number; reason: string }

export const decideAck = (notif: AckNotif | null, userId: number): AckOutcome => {
  if (!notif) return { action: 'reject', status: 404, reason: 'not_found' }
  if (notif.parent !== userId) return { action: 'reject', status: 403, reason: 'forbidden' }
  if (notif.status === 'acked') return { action: 'noop' }
  if (notif.status === 'delivered' || notif.status === 'seen') return { action: 'ack' }
  return { action: 'reject', status: 409, reason: 'stale' } // superseded
}
