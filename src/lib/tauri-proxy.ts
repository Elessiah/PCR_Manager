// Proxy dev-only : remplace @tauri-apps/api/core via alias Vite en mode développement.
// En contexte Tauri (window.__TAURI_INTERNALS__ présent) → délègue au vrai invoke natif.
// En mode browser pur (npm run dev sans backend) → utilise les données mock.
import { devMockInvoke } from './__mocks__/dev-data';

declare global {
  interface Window {
    __TAURI_INTERNALS__?: {
      invoke: <T>(cmd: string, args?: unknown) => Promise<T>;
    };
  }
}

export function invoke<T>(cmd: string, args?: unknown): Promise<T> {
  if (typeof window !== 'undefined' && window.__TAURI_INTERNALS__) {
    return window.__TAURI_INTERNALS__.invoke<T>(cmd, args);
  }
  return devMockInvoke<T>(cmd, args);
}
