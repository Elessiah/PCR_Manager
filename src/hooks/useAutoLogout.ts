import { useEffect, useRef } from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { toast } from 'sonner';

const SLEEP_TIMEOUT_MS     = 10 * 60 * 1000; // 10 min de veille PC
const MINIMIZED_TIMEOUT_MS = 30 * 60 * 1000; // 30 min d'application minimisée
const TICK_MS              = 1_000;
const DRIFT_THRESHOLD_MS   = 3_000;           // drift > 3s = le PC était en veille

/**
 * Déconnexion automatique sur deux conditions :
 *  - veille PC : si le timer dérive de > DRIFT_THRESHOLD_MS, le PC était en veille ;
 *    on accumule la durée et on logout quand SLEEP_TIMEOUT_MS est atteint.
 *  - application minimisée : on note l'heure du minimize et on logout au restore
 *    si MINIMIZED_TIMEOUT_MS est dépassé.
 */
export function useAutoLogout(logout: () => void, isAuthenticated: boolean): void {
  const minimizedAtRef = useRef<number | null>(null);
  const lastTickRef    = useRef<number>(Date.now());
  const sleepAccumRef  = useRef<number>(0);

  useEffect(() => {
    if (!isAuthenticated) return;

    lastTickRef.current    = Date.now();
    sleepAccumRef.current  = 0;
    minimizedAtRef.current = null;

    let active = true;

    const doLogout = () => {
      if (!active) return;
      active = false;
      toast.info('Session expirée, veuillez vous reconnecter.');
      logout();
    };

    // Détection veille PC via drift du timer (désactivée quand minimisé pour
    // éviter les faux positifs liés au throttling du WebView en arrière-plan).
    const intervalId = setInterval(() => {
      if (!active || minimizedAtRef.current !== null) return;

      const now     = Date.now();
      const elapsed = now - lastTickRef.current;
      lastTickRef.current = now;

      if (elapsed > TICK_MS + DRIFT_THRESHOLD_MS) {
        sleepAccumRef.current += elapsed;
        if (sleepAccumRef.current >= SLEEP_TIMEOUT_MS) doLogout();
      } else {
        sleepAccumRef.current = 0;
      }
    }, TICK_MS);

    // Détection minimize via les événements de focus Tauri.
    let unlisten: (() => void) | undefined;

    getCurrentWindow()
      .onFocusChanged(async ({ payload: focused }: { payload: boolean }) => {
        if (!active) return;

        if (focused) {
          const wasMinimizedAt   = minimizedAtRef.current;
          minimizedAtRef.current = null;
          sleepAccumRef.current  = 0;
          lastTickRef.current    = Date.now();

          if (wasMinimizedAt !== null && Date.now() - wasMinimizedAt >= MINIMIZED_TIMEOUT_MS) {
            doLogout();
          }
        } else {
          const minimized = await getCurrentWindow().isMinimized();
          if (minimized && minimizedAtRef.current === null) {
            minimizedAtRef.current = Date.now();
          }
        }
      })
      .then((fn: () => void) => { unlisten = fn; });

    return () => {
      active = false;
      clearInterval(intervalId);
      unlisten?.();
    };
  }, [isAuthenticated, logout]);
}
