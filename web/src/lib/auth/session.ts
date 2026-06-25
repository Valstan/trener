import type { CollectionConfig, Payload } from 'payload'

import { getFieldsToSign, jwtSign } from 'payload'
import { generatePayloadCookie } from 'payload/shared'

import type { User } from '@/payload-types'

// Выписывает СТАНДАРТНУЮ Payload-сессию для пользователя без пароля.
//
// Это та же механика, что внутри payload.login (getFieldsToSign → jwtSign →
// generatePayloadCookie), только триггер — подтверждённое владение email по
// magic-link, а не проверка пароля локальной стратегией. Полученный JWT кладётся
// в cookie 'payload-token' — её же читает дефолтная jwt-стратегия Payload на
// последующих запросах (и getMeUser-клиент через /api/users/me).
//
// ВАЖНО: локальную стратегию НЕ отключаем (disableLocalStrategy сломал бы
// create-first-user bootstrap и пароль-вход персонала в /admin). Magic-link —
// аддитивный путь поверх неё, в основном для родителей.
export const buildAuthCookie = async (payload: Payload, user: User): Promise<string> => {
  const collection = payload.collections['users']?.config
  if (!collection?.auth) {
    throw new Error('users collection is not an auth collection')
  }

  const fieldsToSign = getFieldsToSign({
    // Sanitized config на рантайме содержит всё нужное (slug, auth, поля saveToJWT);
    // .d.ts типизирует параметр как CollectionConfig — приводим явно.
    collectionConfig: collection as unknown as CollectionConfig,
    email: user.email,
    user: { ...user, collection: 'users' },
  })

  const { token } = await jwtSign({
    fieldsToSign,
    secret: payload.secret,
    tokenExpiration: collection.auth.tokenExpiration,
  })

  return generatePayloadCookie({
    collectionAuthConfig: collection.auth,
    cookiePrefix: payload.config.cookiePrefix,
    token,
  })
}
