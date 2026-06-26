import type { Payload } from 'payload'

import type { PushMessage } from './message'

export type PushOutcome = 'ok' | 'failed' | 'skipped'

type VapidConfig = { publicKey: string; privateKey: string; subject: string }

// VAPID-конфиг из env (один на iOS+Android, kickoff §2). Пусто → пуш отключён.
// Публичный ключ совпадает с NEXT_PUBLIC_* (тот уходит в клиент для subscribe).
const getVapidConfig = (): VapidConfig | null => {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  const privateKey = process.env.VAPID_PRIVATE_KEY
  const subject = process.env.VAPID_SUBJECT || 'mailto:admin@trener.example.ru'
  if (!publicKey || !privateKey) return null
  return { publicKey, privateKey, subject }
}

// 404/410 от push-сервиса = подписка мертва (отписались / протухла, особенно iOS).
// Такую запись Devices удаляем (dead-letter), прочие ошибки — счётчик failureCount.
export const isDeadSubscription = (statusCode: number | undefined): boolean =>
  statusCode === 404 || statusCode === 410

// Best-effort пуш всем устройствам пользователя. НЕ источник корректности (её держат
// in-app очередь + coverage); поэтому всё в try/catch, возвращаем сводный результат
// для диагностики (Notifications.pushResult). Реальная доставка iOS/Android — по HTTPS.
export const sendPushToUser = async (
  payload: Payload,
  userId: number,
  message: PushMessage,
): Promise<PushOutcome> => {
  const vapid = getVapidConfig()
  if (!vapid) return 'skipped'

  const devices = await payload.find({
    collection: 'devices',
    where: { user: { equals: userId } },
    depth: 0,
    pagination: false,
    overrideAccess: true,
  })
  if (!devices.docs.length) return 'skipped'

  // Динамический импорт: web-push — node-only (crypto), грузим лениво при отправке.
  const webpush = (await import('web-push')).default
  webpush.setVapidDetails(vapid.subject, vapid.publicKey, vapid.privateKey)
  const body = JSON.stringify(message)

  let anyOk = false
  for (const d of devices.docs) {
    const subscription = { endpoint: d.endpoint, keys: { p256dh: d.p256dh, auth: d.auth } }
    try {
      await webpush.sendNotification(subscription, body)
      anyOk = true
      await payload
        .update({
          collection: 'devices',
          id: d.id,
          data: { lastSuccessAt: new Date().toISOString(), failureCount: 0 },
          overrideAccess: true,
        })
        .catch(() => {})
    } catch (err) {
      const statusCode = (err as { statusCode?: number })?.statusCode
      if (isDeadSubscription(statusCode)) {
        await payload.delete({ collection: 'devices', id: d.id, overrideAccess: true }).catch(() => {})
      } else {
        await payload
          .update({
            collection: 'devices',
            id: d.id,
            data: { failureCount: (d.failureCount ?? 0) + 1 },
            overrideAccess: true,
          })
          .catch(() => {})
      }
    }
  }
  return anyOk ? 'ok' : 'failed'
}
