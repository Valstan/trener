import type { CollectionBeforeDeleteHook } from 'payload'

// Штатного удаления в UI/API нет. Хук нужен только для полного удаления субъекта
// данных владельцем БД: required FK не должен оставить полутранзакцию (G135).
export const cleanupPaymentThread: CollectionBeforeDeleteHook = async ({ id, req: { payload } }) => {
  await payload.delete({ collection: 'payment-messages', where: { thread: { equals: id } }, overrideAccess: true })
}
