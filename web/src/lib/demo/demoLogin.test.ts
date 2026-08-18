import { describe, expect, it } from 'vitest'

import { parseDemoRole } from '@/lib/demo/demoLogin'
import { DEMO_ROLES } from '@/lib/demo/constants'

describe('parseDemoRole', () => {
  it.each(DEMO_ROLES)('принимает валидную роль %s', (role) => {
    expect(parseDemoRole(role)).toBe(role)
  })

  it('отвергает мусорную строку', () => {
    expect(parseDemoRole('owner-admin')).toBeNull()
  })

  it('отвергает пустую строку', () => {
    expect(parseDemoRole('')).toBeNull()
  })

  it('отвергает не-строку (null из FormData.get)', () => {
    expect(parseDemoRole(null)).toBeNull()
  })

  it('отвергает не-строку (число)', () => {
    expect(parseDemoRole(42)).toBeNull()
  })
})
