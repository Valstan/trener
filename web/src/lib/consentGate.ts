import type { CollectionBeforeOperationHook, Payload } from 'payload'

import { NextResponse } from 'next/server'
import { redirect } from 'next/navigation'
import { Forbidden } from 'payload'

import type { User } from '@/payload-types'
import { isParent } from '@/access/roles'
import { relId } from '@/lib/relId'

// Гейт согласия 152-ФЗ (#115/D-016 пререквизит): родитель с привязанными детьми и
// филиалом, но БЕЗ записи согласия — на экран согласия, прежде чем работать в кабинете.
//
// Почему филиал обязателен в условии: экран согласия подставляет оператора ИЗ филиала
// и при branch == null уходит редиректом — гейт без этой проверки закольцевал бы
// легаси-родителей (созданных invite-путём до фикса, у них branch пуст).
export const needsConsent = (i: {
  parent: boolean
  branchId: number | string | null
  playersCount: number
  consentsCount: number
}): boolean => i.parent && i.branchId != null && i.playersCount > 0 && i.consentsCount === 0

export const parentNeedsConsent = async (payload: Payload, user: User): Promise<boolean> => {
  if (!isParent(user)) return false
  const branchId = relId(user.branch)
  if (branchId == null) return false
  const players = await payload.count({
    collection: 'players',
    where: { parent: { equals: user.id } },
    overrideAccess: true,
  })
  if (players.totalDocs === 0) return false
  const consents = await payload.count({
    collection: 'consents',
    where: { and: [{ parent: { equals: user.id } }, { consentGiven: { equals: true } }] },
    overrideAccess: true,
  })
  return needsConsent({
    parent: true,
    branchId,
    playersCount: players.totalDocs,
    consentsCount: consents.totalDocs,
  })
}

// Дальше — гейт на ВСЮ родительскую поверхность (аудит #057, вектор (c), D-016 §5).
// До сих пор он стоял ровно в одном месте (`parent/page.tsx`), поэтому после отзыва
// согласия родитель прямо вводил адрес и видел `/parent/schedule`, `/parent/payments`,
// `/parent/announcements` и `/chat` — то есть обработка ПДн ребёнка продолжалась, хотя
// пуши уже глушились (#195). Три точки входа вместо одной:
//
//   1. СТРАНИЦА  — requireConsentPage (редирект на экран согласия);
//   2. РОУТ      — consentRequiredResponse (403, редирект тут неуместен);
//   3. REST/GraphQL — denyParentWithoutConsent (хук beforeOperation на коллекциях).
//
// Третья точка — главная: UI можно обойти адресной строкой и API-вызовом, поэтому
// проверка «в роуте» без проверки «в коллекции» оставляет дыру.

/** Куда отправляем родителя без согласия. Экран согласия (он же онбординг-шаг). */
const CONSENT_PATH = '/onboarding/consent'

/** Страница/server component: тихо уводим на экран согласия. Неавторизованных не трогаем. */
export const requireConsentPage = async (payload: Payload, user: User | null | undefined): Promise<void> => {
  if (!user) return
  if (await parentNeedsConsent(payload, user)) redirect(CONSENT_PATH)
}

/**
 * Роут (server action): ответ 403, если родитель без согласия. `null` — можно идти
 * дальше. Неавторизованных не трогаем: 401 остаётся на совести вызывающего.
 */
export const consentRequiredResponse = async (
  payload: Payload,
  user: User | null | undefined,
): Promise<Response | null> => {
  if (!user) return null
  if (!(await parentNeedsConsent(payload, user))) return null
  return NextResponse.json({ ok: false, reason: 'consent-required' }, { status: 403 })
}

/**
 * REST/GraphQL-гейт: родителю без согласия коллекция с ПДн ребёнка недоступна.
 *
 * `overrideAccess: true` — это НАШ серверный код (роуты с `user` в гейте страницы,
 * сиды, экспорт), его пропускаем: иначе гейт мешал бы самому себе и не работал бы
 * вовсе. Обойти это извне нельзя — REST `overrideAccess` из запроса клиента НЕ читает
 * (проверено по исходникам payload 3.90: 0 совпадений `searchParams.get('override…')`),
 * так что снаружи флаг всегда false и гейт срабатывает всегда.
 */
export const denyParentWithoutConsent: CollectionBeforeOperationHook = async ({ req, overrideAccess }) => {
  if (overrideAccess === true) return
  const user = req.user as User | null | undefined
  if (!user || !isParent(user)) return
  if (await parentNeedsConsent(req.payload, user)) throw new Forbidden(req.t)
}