import type { CollectionBeforeChangeHook } from 'payload'

// Bootstrap: самый первый созданный пользователь становится владельцем сети (M5;
// до M5 — admin), независимо от присланных ролей. Иначе на экране create-first-user
// легко завести аккаунт без god-роли и запереть себя снаружи управления
// пользователями (create/delete = adminOnly → owner).
export const ensureFirstUserAdmin: CollectionBeforeChangeHook = async ({ req, operation, data }) => {
  if (operation !== 'create') return data

  const { totalDocs } = await req.payload.count({ collection: 'users', overrideAccess: true })
  if (totalDocs === 0) {
    const roles = new Set<string>(Array.isArray(data.roles) ? data.roles : [])
    roles.add('owner')
    data.roles = Array.from(roles)
  }

  return data
}
