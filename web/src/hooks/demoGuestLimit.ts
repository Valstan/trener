import type { CollectionBeforeChangeHook } from 'payload'

import { DEMO_GUEST_LIMIT, DEMO_LIMIT_MESSAGE } from '../lib/demo/constants'

// Лимит витрины D-029: посетитель (демо-юзер) создаёт ≤5 СВОИХ сущностей в разделе.
// Сид пишет через Local API без user → demoGuest=false, богатый сид в лимит не
// упирается. Гонка двух посетителей (6-я вместо 5-й) — не инцидент, reseed ночью.
//
// Поле demoGuest у каждой коллекции field-locked (access.create/update: () => false) —
// это режет только КЛИЕНТСКИЙ ввод (REST/GraphQL/форма админки), см. Payload 3
// executeAccess: field-access для create-полей проверяется до валидации, но
// значение, которое beforeChange-хук допишет в data ПОСЛЕ этой проверки, доходит
// до записи как есть — beforeChange выполняется позже field-access и не режется
// им повторно. Поэтому demoGuest:true, проставленный здесь, сохраняется, хотя
// прямой { demoGuest: true } в теле запроса клиента был бы обнулён на входе.
// Порядок подтверждён юнит-тестом хука; живой end-to-end прогон на Payload —
// зона внимания приёмки PR-4 (см. отчёт).
export const demoGuestLimit: CollectionBeforeChangeHook = async ({ req, operation, data, collection }) => {
  if (operation !== 'create' || !req.user?.demo) return data
  const { totalDocs } = await req.payload.count({
    collection: collection.slug,
    where: { demoGuest: { equals: true } },
    overrideAccess: true,
  })
  if (totalDocs >= DEMO_GUEST_LIMIT) throw new Error(DEMO_LIMIT_MESSAGE)
  return { ...data, demoGuest: true }
}
