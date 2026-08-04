import type { CollectionBeforeDeleteHook } from 'payload'

export const cleanupMatchRelations: CollectionBeforeDeleteHook = async ({ id, req: { payload } }) => {
  await payload.delete({
    collection: 'match-comments',
    where: { match: { equals: id } },
    overrideAccess: true,
  })
}
