import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [react()],
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
  },
  resolve: {
    // Dev bypass : en mode non-production, @tauri-apps/api/core est remplacé
    // par tauri-proxy.ts qui délègue au vrai invoke si __TAURI_INTERNALS__
    // est présent (tauri:dev), sinon utilise le store mock en mémoire.
    alias: mode !== 'production' ? {
      '@tauri-apps/api/core': fileURLToPath(
        new URL('./src/lib/tauri-proxy.ts', import.meta.url)
      ),
    } : {},
  },
}))
