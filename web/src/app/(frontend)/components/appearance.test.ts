import { describe, expect, it } from 'vitest'

import { visualStyleFromStorage, zoneForPath } from './appearance'

describe('football appearance helpers', () => {
  it('restores only the explicit football preference', () => {
    expect(visualStyleFromStorage('football')).toBe('football')
    expect(visualStyleFromStorage('classic')).toBe('classic')
    expect(visualStyleFromStorage('unexpected')).toBe('classic')
    expect(visualStyleFromStorage(null)).toBe('classic')
  })

  it.each([
    ['/parent/schedule', 'schedule'],
    ['/coach/session/42', 'schedule'],
    ['/parent/matches', 'matches'],
    ['/match/7', 'matches'],
    ['/chat/3', 'chat'],
    ['/parent/ask', 'chat'],
    ['/coach/payments', 'payments'],
    ['/parent/payment-chat', 'payments'],
    ['/coach/legal', 'legal'],
    ['/privacy', 'legal'],
    ['/home', 'general'],
  ])('maps %s to the %s visual zone', (pathname, zone) => {
    expect(zoneForPath(pathname)).toBe(zone)
  })
})
