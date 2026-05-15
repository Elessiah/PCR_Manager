import { describe, it, expect } from 'vitest';
import { habilitationToBadge } from '../habilitation';

describe('habilitation', () => {
  describe('habilitationToBadge', () => {
    it('should map validee to correct badge', () => {
      const badge = habilitationToBadge.validee;
      expect(badge.label).toBe('Validee');
      expect(badge.variant).toBe('ok');
    });

    it('should map partielle to correct badge', () => {
      const badge = habilitationToBadge.partielle;
      expect(badge.label).toBe('Partielle');
      expect(badge.variant).toBe('warn');
    });

    it('should map non_validee to correct badge', () => {
      const badge = habilitationToBadge.non_validee;
      expect(badge.label).toBe('Non validee');
      expect(badge.variant).toBe('neutral');
    });
  });
});
