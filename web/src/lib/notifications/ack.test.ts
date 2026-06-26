import { describe, it, expect } from 'vitest'

import { decideAck } from './ack'

// M8: ack только владельцем и только вперёд. Чистая функция-решение для эндпоинта.
describe('decideAck', () => {
  it('delivered владельцем → ack', () => {
    expect(decideAck({ parent: 5, status: 'delivered' }, 5)).toEqual({ action: 'ack' })
  })
  it('seen владельцем → ack', () => {
    expect(decideAck({ parent: 5, status: 'seen' }, 5)).toEqual({ action: 'ack' })
  })
  it('уже acked → noop (идемпотентно)', () => {
    expect(decideAck({ parent: 5, status: 'acked' }, 5)).toEqual({ action: 'noop' })
  })
  it('superseded → reject 409 (устарело)', () => {
    expect(decideAck({ parent: 5, status: 'superseded' }, 5)).toEqual({
      action: 'reject',
      status: 409,
      reason: 'stale',
    })
  })
  it('чужое уведомление → reject 403', () => {
    expect(decideAck({ parent: 99, status: 'delivered' }, 5)).toEqual({
      action: 'reject',
      status: 403,
      reason: 'forbidden',
    })
  })
  it('нет уведомления → reject 404', () => {
    expect(decideAck(null, 5)).toEqual({ action: 'reject', status: 404, reason: 'not_found' })
  })
})
