export type StatusColor = 'valide' | 'a_prevoir' | 'en_retard' | 'non_applicable';

export function statusFromDate(
  deadlineIso: string | null | undefined,
  alertMonths: number = 1
): StatusColor {
  if (!deadlineIso) return 'non_applicable';

  const now = new Date();
  const deadline = new Date(deadlineIso);

  if (Number.isNaN(deadline.getTime())) return 'non_applicable';

  if (deadline < now) return 'en_retard';

  const alertThreshold = new Date(now);
  alertThreshold.setMonth(alertThreshold.getMonth() + alertMonths);

  if (deadline <= alertThreshold) return 'a_prevoir';

  return 'valide';
}

export const statusToBadgeVariant: Record<StatusColor, 'ok' | 'warn' | 'danger' | 'neutral'> = {
  valide: 'ok',
  a_prevoir: 'warn',
  en_retard: 'danger',
  non_applicable: 'neutral',
};
