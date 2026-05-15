import type { HabilitationStatut } from '../types/domain';

export const habilitationToBadge: Record<
  HabilitationStatut,
  { label: string; variant: 'ok' | 'warn' | 'neutral' }
> = {
  validee: { label: 'Validee', variant: 'ok' },
  partielle: { label: 'Partielle', variant: 'warn' },
  non_validee: { label: 'Non validee', variant: 'neutral' },
};
