import { describe, expect, it } from 'vitest'

import { applicantUpgrade } from './applicantUpgrade'

describe('applicantUpgrade', () => {
  it('чистый applicant → приглашённая роль', () => {
    expect(applicantUpgrade(['applicant'], 'parent')).toEqual(['parent'])
    expect(applicantUpgrade(['applicant'], 'coach')).toEqual(['coach'])
  })

  it('пустые роли → приглашённая роль', () => {
    expect(applicantUpgrade([], 'parent')).toEqual(['parent'])
    expect(applicantUpgrade(null, 'parent')).toEqual(['parent'])
    expect(applicantUpgrade(undefined, 'admin')).toEqual(['admin'])
  })

  it('живой аккаунт с содержательной ролью — НЕ трогаем (анти-перезапись)', () => {
    expect(applicantUpgrade(['coach'], 'parent')).toBeNull()
    expect(applicantUpgrade(['parent'], 'coach')).toBeNull()
    expect(applicantUpgrade(['owner'], 'admin')).toBeNull()
    expect(applicantUpgrade(['applicant', 'child'], 'parent')).toBeNull()
  })
})
