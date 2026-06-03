/** Mappe les valeurs DB (contrainte CHECK) vers leur libellé affichable. */

export const FONCTION_LABELS: Record<string, string> = {
  Cardiologue: 'Cardiologue',
  Cardiologue_liberal: 'Cardiologue libéral',
  MERM: 'MERM',
  Infirmier: 'Infirmier',
};

export function fonctionLabel(value: string | null | undefined): string | null {
  if (!value) return null;
  return FONCTION_LABELS[value] ?? value;
}
