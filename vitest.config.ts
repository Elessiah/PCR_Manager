import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

// Standalone vitest config with jsdom environment for frontend testing
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    css: false,
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    exclude: ['node_modules', 'dist', '.claude', '.git'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
    },
  },
})
