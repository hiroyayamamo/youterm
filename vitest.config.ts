import { defineConfig } from 'vitest/config'
import { resolve } from 'node:path'

export default defineConfig({
  test: {
    globals: true,
    include: ['tests/**/*.test.ts'],
    exclude: ['tests/e2e/**', 'node_modules/**'],
  },
  resolve: {
    alias: {
      '@shared': resolve(__dirname, 'src/shared'),
    },
  },
})
