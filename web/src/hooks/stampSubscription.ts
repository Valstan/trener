import type { CollectionBeforeChangeHook } from 'payload'

import type { Subscription } from '../payload-types'
import { adminBranchId } from '../access/roles'
import { relId } from '../lib/relId'

// Штамп записи оплаты (M8 доводка 09.08), beforeChange на create:
//   • recordedBy — КТО отметил оплату (раньше запись была анонимной: владелец не
//     мог ответить «кто и когда отметил эту оплату»);
//   • branch — денорм филиала НА МОМЕНТ записи: филиал выводился через
//     player→group→branch, а #111 умеет переводить ребёнка между группами —
//     без денорма история выручки филиала переписывалась задним числом;
//   • гейт границы для админа филиала — G211-класс: access-Where на СОЗДАНИИ
//     ничего не ограничивает, поэтому «чужого ребёнка не записать» держит хук.
// Служебные find'ы — overrideAccess (G90). Работает и для админки, и для
// server-mediated маршрута (тот передаёт user).
export const stampSubscription: CollectionBeforeChangeHook<Subscription> = async ({
  data,
  operation,
  req,
}) => {
  if (operation !== 'create' || !data) return data

  if (req.user && data.recordedBy == null) data.recordedBy = req.user.id

  const playerId = relId(data.player)
  if (playerId != null) {
    try {
      const player = await req.payload.findByID({ collection: 'players', id: playerId, depth: 0, overrideAccess: true })
      const groupId = relId(player?.group)
      let branchId = relId(player?.branch)
      if (groupId != null) {
        const group = await req.payload
          .findByID({ collection: 'groups', id: groupId, depth: 0, overrideAccess: true })
          .catch(() => null)
        branchId = relId(group?.branch) ?? branchId
      }

      const myBranch = req.user ? adminBranchId(req.user) : null
      if (myBranch != null && String(branchId) !== String(myBranch)) {
        throw new Error('Оплату можно записать только ребёнку своего филиала')
      }

      if (data.branch == null && branchId != null) data.branch = Number(branchId)
    } catch (err) {
      if (err instanceof Error && err.message.includes('своего филиала')) throw err
      req.payload.logger.warn({ err, playerId }, '[subscription] не удалось определить филиал записи')
    }
  }

  return data
}
