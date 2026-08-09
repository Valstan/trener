import { describe, expect, it } from 'vitest'

import { adultApproveData, childTransition } from './registrationFlow'

describe('childTransition', () => {
  it('reject: до принятия можно, принятую — нельзя', () => {
    expect(childTransition('owner_review', 'reject')).toBe('rejected')
    expect(childTransition('parent_review', 'reject')).toBe('rejected')
    expect(childTransition('accepted', 'reject')).toBeNull()
    expect(childTransition('rejected', 'reject')).toBeNull()
  })

  it('reopen: зависшую у родителя и отклонённую — на проверку владельца', () => {
    expect(childTransition('parent_review', 'reopen')).toBe('owner_review')
    expect(childTransition('rejected', 'reopen')).toBe('owner_review')
    expect(childTransition('owner_review', 'reopen')).toBeNull()
    expect(childTransition('accepted', 'reopen')).toBeNull()
  })
})

describe('adultApproveData', () => {
  it('parent/coach с филиалом → роли и approved', () => {
    expect(adultApproveData('parent', 3)).toEqual({ roles: ['parent'], status: 'approved', branch: 3 })
    expect(adultApproveData('coach', 1)).toEqual({ roles: ['coach'], status: 'approved', branch: 1 })
  })

  it('без филиала — отказ (скоупинг и согласие без филиала не работают)', () => {
    expect(adultApproveData('parent', null)).toBeNull()
  })

  it('чужая/пустая роль — отказ (роль только из requestedRole)', () => {
    expect(adultApproveData('child', 1)).toBeNull()
    expect(adultApproveData('owner', 1)).toBeNull()
    expect(adultApproveData(null, 1)).toBeNull()
  })
})
