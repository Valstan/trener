import { defineConfig } from 'vitest/config'

// Юнит-тесты — чистая логика без БД/payload.init (роли, утилиты).
// Интеграционные тесты (payload.init → Postgres) появятся отдельно на M2+ (#011).
export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
})
