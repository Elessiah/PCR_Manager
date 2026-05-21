import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';

/**
 * Invalide le cache React Query à chaque minuit afin que les statuts basés
 * sur la date (en_retard, a_prevoir, valide) se recalculent automatiquement
 * sans intervention de l'utilisateur.
 */
export function useMidnightRefresh(): void {
  const qc = useQueryClient();

  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout>;

    const scheduleNextRefresh = () => {
      const now = new Date();
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(0, 0, 1, 0);
      const msUntilMidnight = tomorrow.getTime() - now.getTime();

      timeoutId = setTimeout(() => {
        qc.invalidateQueries();
        scheduleNextRefresh();
      }, msUntilMidnight);
    };

    scheduleNextRefresh();
    return () => clearTimeout(timeoutId);
  }, [qc]);
}
