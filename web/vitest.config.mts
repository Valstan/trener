import { fileURLToPath } from 'node:url'

import { defineConfig } from 'vitest/config'

// Юнит-тесты — чистая логика без БД/payload.init (роли, утилиты).
// Интеграционные тесты (payload.init → Postgres) появятся отдельно на M2+ (#011).
export default defineConfig({
  // Тот же `@/*`→`src/*` алиас, что в tsconfig — чтобы тестируемые модули могли
  // импортировать соседей через `@/…`, а не только относительными путями.
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
})
