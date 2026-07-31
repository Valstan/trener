import { describe, expect, it } from 'vitest'

import { branchPrivacyHref, isOperatorFinalized, operatorFromBranch } from './operator'

const complete = {
  id: 2,
  name: 'Филиал',
  operatorName: 'Школа № 1',
  operatorLegalForm: 'ООО',
  operatorInn: '1234567890',
  operatorAddress: 'Кировская область',
  operatorEmail: 'privacy@school.test',
  operatorPhone: '+7 900 000-00-00',
  processorAgreementSignedAt: '2026-07-31T00:00:00.000Z',
}

describe('branch operator', () => {
  it('is finalized only with details and signed processing agreement', () => {
    expect(isOperatorFinalized(complete)).toBe(true)
    expect(isOperatorFinalized({ ...complete, operatorInn: '' })).toBe(false)
    expect(isOperatorFinalized({ ...complete, processorAgreementSignedAt: null })).toBe(false)
  })

  it('uses branch name when an explicit operator name is absent', () => {
    expect(operatorFromBranch({ id: 1, name: 'Юность' }).name).toBe('Юность')
  })

  it('builds a branch-specific public policy URL', () => {
    expect(branchPrivacyHref(12)).toBe('/privacy?branch=12')
  })
})
