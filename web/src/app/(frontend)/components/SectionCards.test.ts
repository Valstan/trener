import { describe, expect, it } from 'vitest'

import { sectionsForRoles } from './SectionCards'

const keysFor = (roles: string[]) => sectionsForRoles({ roles }).map((section) => section.key)

describe('sectionsForRoles', () => {
  it('не показывает тренеру оплату', () => {
    expect(keysFor(['coach'])).not.toContain('payments')
  })

  it.each(['owner', 'admin'])('показывает оплату управляющей роли %s', (role) => {
    expect(keysFor([role])).toContain('payments')
  })

  it('показывает родителю только его платёжный раздел', () => {
    expect(sectionsForRoles({ roles: ['parent'] })).toContainEqual(
      expect.objectContaining({ key: 'payments', href: '/parent/payments' }),
    )
  })
})
