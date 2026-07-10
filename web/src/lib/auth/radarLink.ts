import type { Payload } from 'payload'

import type { User } from '@/payload-types'

import type { RadarClaims } from './oidc'
import { generateRawToken } from './tokens'

// ── Связывание личности Радара с аккаунтом trener (docs/auth-sso-vk.md §3.3) ──
//
// Радар удостоверяет «кто человек» (sub/email/имя), но НЕ «чей он родитель» и
// НЕ роли trener. Порядок поиска:
//   1) по (authProvider='radar', externalId=sub) — уже связанный аккаунт;
//   2) по ПОДТВЕРЖДЁННОМУ email — привязываем Радар-личность к существующему
//      аккаунту (родитель, заведённый invite'ом, входит через VK бесшовно);
//   3) не нашли — создаём нового пользователя с наименьшей ролью parent.
//
// Анти-захват аккаунта (два правила):
//   • связывание по email — ТОЛЬКО при email_verified=true от Радара: иначе
//     VK-аккаунт с чужим неподтверждённым email «прилип» бы к аккаунту персонала;
//   • если найденный по email аккаунт УЖЕ связан с другим sub — не перепривязываем
//     (иначе вторая Радар-личность с тем же email увела бы чужой аккаунт).
// В обоих случаях заводим ОТДЕЛЬНОГО пользователя.

export type LinkAction = 'login' | 'link-email' | 'create-with-email' | 'create-opaque'

// Чистое решение (тестируем юнитом): что делать по результатам двух поисков.
export const linkDecision = (
  foundBySub: boolean,
  foundByEmail: boolean,
  emailAlreadyLinkedToOtherSub: boolean,
  claims: Pick<RadarClaims, 'email' | 'emailVerified'>,
): LinkAction => {
  if (foundBySub) return 'login'
  if (!claims.email || !claims.emailVerified) return 'create-opaque'
  if (!foundByEmail) return 'create-with-email'
  return emailAlreadyLinkedToOtherSub ? 'create-opaque' : 'link-email'
}

// Пользователь без пригодного email (нет / не подтверждён) всё равно требует
// email — users auth-коллекция. Синтезируем детерминированный служебный адрес:
// повторный вход того же sub идемпотентен, а magic-link на него не отправить
// (домен .invalid не маршрутизируется — RFC 2606), вход только через VK.
export const syntheticRadarEmail = (sub: string): string =>
  `radar-${sub.toLowerCase().replace(/[^a-z0-9-]/g, '')}@sso.invalid`

// Служебные find/update/create — overrideAccess:true (G90: без него access.read
// коллекции рекурсит; здесь доверенный серверный путь после проверки id_token).
export const findOrLinkRadarUser = async (
  payload: Payload,
  claims: RadarClaims,
): Promise<User> => {
  const bySub = await payload.find({
    collection: 'users',
    where: {
      and: [{ authProvider: { equals: 'radar' } }, { externalId: { equals: claims.sub } }],
    },
    limit: 1,
    depth: 0,
    pagination: false,
    overrideAccess: true,
  })

  let byEmailUser: User | undefined
  if (claims.email && claims.emailVerified) {
    const byEmail = await payload.find({
      collection: 'users',
      where: { email: { equals: claims.email } },
      limit: 1,
      depth: 0,
      pagination: false,
      overrideAccess: true,
    })
    byEmailUser = byEmail.docs[0]
  }

  const action = linkDecision(
    Boolean(bySub.docs[0]),
    Boolean(byEmailUser),
    Boolean(byEmailUser?.externalId && byEmailUser.externalId !== claims.sub),
    claims,
  )

  switch (action) {
    case 'login':
      return bySub.docs[0]!
    case 'link-email':
      return payload.update({
        collection: 'users',
        id: byEmailUser!.id,
        data: {
          authProvider: 'radar',
          externalId: claims.sub,
          // Имя из Радара — только если своего ещё нет (не затираем локальное).
          ...(byEmailUser!.name ? {} : claims.name ? { name: claims.name } : {}),
        },
        overrideAccess: true,
      })
    case 'create-with-email':
    case 'create-opaque':
      return payload.create({
        collection: 'users',
        data: {
          email: action === 'create-with-email' ? claims.email! : syntheticRadarEmail(claims.sub),
          // Локальная стратегия включена → password обязателен. Случайный: вход
          // этого пользователя — через VK (и magic-link, если email реальный).
          password: generateRawToken(),
          roles: ['parent'],
          authProvider: 'radar',
          externalId: claims.sub,
          ...(claims.name ? { name: claims.name } : {}),
        },
        overrideAccess: true,
      })
  }
}
