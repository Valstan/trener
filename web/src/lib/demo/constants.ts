// Демо-режим D-029: один демо-филиал + 5 общих демо-аккаунтов (по роли).
// Email'ы на нерутируемом домене — наружу писем не бывает даже при ошибке глушителя.
export const DEMO_ROLES = ['owner', 'admin', 'coach', 'parent', 'child'] as const
export type DemoRole = (typeof DEMO_ROLES)[number]
export const DEMO_EMAILS: Record<DemoRole, string> = {
  owner: 'demo-owner@trener.local',
  admin: 'demo-admin@trener.local',
  coach: 'demo-coach@trener.local',
  parent: 'demo-parent@trener.local',
  child: 'demo-child@trener.local',
}
export const DEMO_BRANCH_NAME = 'ФК Звёздочка'
export const DEMO_GUEST_LIMIT = 5
export const DEMO_LIMIT_MESSAGE =
  'В демо можно создать не больше 5 — этого хватит, чтобы всё попробовать'
