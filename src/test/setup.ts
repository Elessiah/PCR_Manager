import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach, vi } from 'vitest'

// Mock Tauri API : invoke() retourne Promise<null> par défaut.
// Chaque test peut surcharger avec vi.mocked(invoke).mockImplementation(...)
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn().mockResolvedValue(null),
}))

// Cleanup after each test
afterEach(() => {
  vi.clearAllMocks()
  cleanup()
})
