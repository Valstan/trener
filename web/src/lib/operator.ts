// 152-ФЗ: оператор — конкретная школа (филиал), платформа обрабатывает данные
// по её поручению (ст. 6 ч. 3). Глобального оператора нет: реквизиты берутся из
// Branches, чтобы родитель никогда не соглашался с оператором другой школы.

export const PROCESSOR_NAME = 'Платформа «Футбольная школа»'

export interface OperatorBranch {
  id: number
  name: string
  operatorName?: string | null
  operatorLegalForm?: string | null
  operatorInn?: string | null
  operatorAddress?: string | null
  operatorEmail?: string | null
  operatorPhone?: string | null
  operatorResponsiblePerson?: string | null
  processorAgreementSignedAt?: string | null
  rknNotifiedAt?: string | null
}

export interface OperatorDetails {
  name: string
  legalForm: string
  inn: string
  address: string
  email: string
  phone: string
  responsiblePerson: string | null
}

const clean = (value: string | null | undefined): string => value?.trim() ?? ''

export const operatorFromBranch = (branch: OperatorBranch): OperatorDetails => ({
  name: clean(branch.operatorName) || branch.name,
  legalForm: clean(branch.operatorLegalForm),
  inn: clean(branch.operatorInn),
  address: clean(branch.operatorAddress),
  email: clean(branch.operatorEmail),
  phone: clean(branch.operatorPhone),
  responsiblePerson: clean(branch.operatorResponsiblePerson) || null,
})

// Пер-филиальный эквивалент прежнего OPERATOR_FINALIZED. Он вычисляемый: одной
// галочкой нельзя объявить документ действующим при пустых реквизитах.
export const isOperatorFinalized = (branch: OperatorBranch): boolean => {
  const operator = operatorFromBranch(branch)
  return Boolean(
    operator.name &&
    operator.legalForm &&
    operator.inn &&
    operator.address &&
    operator.email &&
    operator.phone &&
    branch.processorAgreementSignedAt,
  )
}

export const branchPrivacyHref = (branchId: number): string => `/privacy?branch=${branchId}`
