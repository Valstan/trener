import type { Payload, PayloadRequest } from 'payload'

import { adminBranchId, branchGroupIds, coachGroupIds, isFullOwner } from '@/access/roles'
import type { User } from '@/payload-types'

// Скоуп персонала над группой — одна лестница для всех server-mediated роутов
// (D-029 / #166, 23.08.2026): живой владелец — любая группа; admin и ДЕМО-owner/admin —
// только группы своего филиала (adminBranchId); тренер — только свои (coaches ∋ user).
//
// Почему не `if (!isOwner(user))`: демо-владелец формально owner, и такой гейт
// пропускал его к группам ЖИВЫХ филиалов (тренировки, объявления, матчи → пуши
// живым родителям). access.create с Where Payload не фильтрует (G211), роуты пишут
// с overrideAccess — значит, эта проверка и есть граница. Та же лестница, что
// coachCanSeeSession (lib/coverage.ts).
export const staffCanManageGroup = async (
  payload: Payload,
  user: Pick<User, 'id' | 'roles' | 'branch' | 'demo'>,
  groupId: string | number,
): Promise<boolean> => {
  if (isFullOwner(user)) return true
  const req = { payload } as unknown as PayloadRequest
  const branch = adminBranchId(user)
  const ids = branch != null ? await branchGroupIds(req, branch) : await coachGroupIds(req, user.id)
  return ids.some((id) => String(id) === String(groupId))
}
