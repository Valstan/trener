import type { CollectionConfig, Payload, TypedUser } from 'payload'

import { createLocalReq, getFieldsToSign, jwtSign } from 'payload'
import { addSessionToUser, generatePayloadCookie } from 'payload/shared'

import type { User } from '@/payload-types'

// Выписывает СТАНДАРТНУЮ Payload-сессию для пользователя без пароля.
//
// Это та же механика, что внутри payload.login (addSessionToUser → getFieldsToSign →
// jwtSign → generatePayloadCookie), только триггер — подтверждённое владение email
// по magic-link, а не проверка пароля локальной стратегией. Полученный JWT кладётся
// в cookie 'payload-token' — её же читает дефолтная jwt-стратегия Payload на
// последующих запросах (и getMeUser-клиент через /api/users/me).
//
// ⚠️ Payload 3.x по умолчанию `auth.useSessions: true`: jwt-стратегия принимает токен
// ТОЛЬКО если в нём есть `sid`, указывающий на живую запись в user.sessions. Раньше
// мы подписывали токен БЕЗ sid (как «recipe R12») — он молча отвергался payload.auth
// (вход «успешен», но кука не авторизует; типы зелёные, ломается на рантайме). Поэтому
// создаём сессию через addSessionToUser (тот же путь, что в payload.login) и кладём sid.
//
// ВАЖНО: локальную стратегию НЕ отключаем (disableLocalStrategy сломал бы
// create-first-user bootstrap и пароль-вход персонала в /admin). Magic-link —
// аддитивный путь поверх неё, в основном для родителей.
export const buildAuthCookie = async (payload: Payload, user: User): Promise<string> => {
  const collection = payload.collections['users']?.config
  if (!collection?.auth) {
    throw new Error('users collection is not an auth collection')
  }

  // Создаём session (если коллекция useSessions) → получаем sid, который payload.auth
  // сверит с user.sessions. addSessionToUser мутирует user.sessions и персистит его.
  const req = await createLocalReq({}, payload)
  const { sid } = await addSessionToUser({
    collectionConfig: collection,
    payload,
    req,
    user: user as TypedUser,
  })

  const fieldsToSign = getFieldsToSign({
    // Sanitized config на рантайме содержит всё нужное (slug, auth, поля saveToJWT);
    // .d.ts типизирует параметр как CollectionConfig — приводим явно.
    collectionConfig: collection as unknown as CollectionConfig,
    email: user.email,
    sid,
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
