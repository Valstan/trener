import type { CollectionBeforeChangeHook } from 'payload'

// Bootstrap: самый первый созданный пользователь становится админом, независимо от
// присланных ролей. Иначе на экране create-first-user легко завести аккаунт без
// роли admin и запереть себя снаружи управления пользователями (create/delete = adminOnly).
export const ensureFirstUserAdmin: CollectionBeforeChangeHook = async ({ req, operation, data }) => {
  if (operation !== 'create') return data

  const { totalDocs } = await req.payload.count({ collection: 'users', overrideAccess: true })
  if (totalDocs === 0) {
    const roles = new Set<string>(Array.isArray(data.roles) ? data.roles : [])
    roles.add('admin')
    data.roles = Array.from(roles)
  }

  return data
}
