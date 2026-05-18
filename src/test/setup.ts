import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach, vi } from 'vitest'

// Mock Tauri API : invoke() retourne Promise<null> par défaut.
// Chaque test peut surcharger avec vi.mocked(invoke).mockImplementation(...)
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn().mockResolvedValue(null),
}))

// Mock Tauri window API : évite les appels IPC dans les tests.
vi.mock('@tauri-apps/api/window', () => ({
  getCurrentWindow: () => ({
    onFocusChanged: vi.fn().mockResolvedValue(() => {}),
    isMinimized: vi.fn().mockResolvedValue(false),
  }),
}))

// Cleanup after each test
afterEach(() => {
  vi.clearAllMocks()
  cleanup()
})
