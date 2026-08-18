import { DEMO_ROLES, type DemoRole } from '@/lib/demo/constants'

// Чистая функция разбора роли из form-data (или любого unknown) — вынесена из
// роута /demo/login, чтобы валидацию можно было покрыть юнит-тестом без
// поднятия Payload/Next.
export const parseDemoRole = (raw: unknown): DemoRole | null => {
  if (typeof raw !== 'string') return null
  return (DEMO_ROLES as readonly string[]).includes(raw) ? (raw as DemoRole) : null
}
