export type VisualStyle = 'classic' | 'football'

export const visualStyleFromStorage = (value: string | null): VisualStyle =>
  value === 'football' ? 'football' : 'classic'

export const zoneForPath = (pathname: string): string => {
  if (/\/(match|matches)(\/|$)/.test(pathname)) return 'matches'
  if (/\/(schedule|session)(\/|$)/.test(pathname)) return 'schedule'
  if (/\/(chat|ask|question|questions)(\/|$)/.test(pathname)) return 'chat'
  if (/\/(payment|payments|payment-chat|payment-chats)(\/|$)/.test(pathname)) return 'payments'
  if (/\/(legal|privacy|consent)(\/|$)/.test(pathname)) return 'legal'
  return 'general'
}
