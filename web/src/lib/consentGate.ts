import type { Payload } from 'payload'

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
