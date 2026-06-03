export type StatusColor = 'valide' | 'a_prevoir' | 'en_retard' | 'non_applicable';

export function statusFromDate(
  deadlineIso: string | null | undefined,
  alertMonths: number = 1
): StatusColor {
  if (!deadlineIso) return 'non_applicable';

  const deadlineDateStr = deadlineIso.split('T')[0];
  if (!/^\d{4}-\d{2}-\d{2}$/.test(deadlineDateStr)) return 'non_applicable';

  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const todayStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;

  if (deadlineDateStr <= todayStr) return 'en_retard';

  const alert = new Date(now);
  alert.setMonth(alert.getMonth() + alertMonths);
  const alertStr = `${alert.getFullYear()}-${pad(alert.getMonth() + 1)}-${pad(alert.getDate())}`;

  if (deadlineDateStr <= alertStr) return 'a_prevoir';

  return 'valide';
}

// Returns null if not validated, otherwise the expiry status derived from date_peremption.
// date_peremption === null means no expiry → always 'valide'.
export function competenceStatus(
  validated: number | undefined,
  datePeremption: string | null | undefined,
  alertMonths: number
): 'valide' | 'a_prevoir' | 'en_retard' | null {
  if (validated !== 1) return null;
  if (!datePeremption) return 'valide';
  const s = statusFromDate(datePeremption, alertMonths);
  return s === 'non_applicable' ? 'valide' : s;
}

export const statusToBadgeVariant: Record<StatusColor, 'ok' | 'warn' | 'danger' | 'neutral'> = {
  valide: 'ok',
  a_prevoir: 'warn',
  en_retard: 'danger',
  non_applicable: 'neutral',
};
