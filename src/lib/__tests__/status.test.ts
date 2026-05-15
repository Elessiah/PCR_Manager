import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { statusFromDate, statusToBadgeVariant } from '../status';

describe('status', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-15T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('statusFromDate', () => {
    it('should return non_applicable for null', () => {
      expect(statusFromDate(null)).toBe('non_applicable');
    });

    it('should return non_applicable for undefined', () => {
      expect(statusFromDate(undefined)).toBe('non_applicable');
    });

    it('should return non_applicable for empty string', () => {
      expect(statusFromDate('')).toBe('non_applicable');
    });

    it('should return non_applicable for invalid date string', () => {
      expect(statusFromDate('not-a-date')).toBe('non_applicable');
    });

    it('should return en_retard for passed deadline', () => {
      expect(statusFromDate('2026-05-14T00:00:00Z')).toBe('en_retard');
    });

    it('should return a_prevoir for deadline within alert months (default 1)', () => {
      expect(statusFromDate('2026-05-20T00:00:00Z')).toBe('a_prevoir');
    });

    it('should return valide for deadline beyond alert months', () => {
      expect(statusFromDate('2027-01-01T00:00:00Z')).toBe('valide');
    });

    it('should respect custom alertMonths parameter', () => {
      expect(statusFromDate('2026-07-15T00:00:00Z', 3)).toBe('a_prevoir');
    });

    it('should return a_prevoir for deadline at exact alert threshold', () => {
      const threshold = new Date('2026-05-15T12:00:00Z');
      threshold.setMonth(threshold.getMonth() + 1);
      expect(statusFromDate(threshold.toISOString())).toBe('a_prevoir');
    });
  });

  describe('statusToBadgeVariant', () => {
    it('should map valide to ok', () => {
      expect(statusToBadgeVariant.valide).toBe('ok');
    });

    it('should map a_prevoir to warn', () => {
      expect(statusToBadgeVariant.a_prevoir).toBe('warn');
    });

    it('should map en_retard to danger', () => {
      expect(statusToBadgeVariant.en_retard).toBe('danger');
    });

    it('should map non_applicable to neutral', () => {
      expect(statusToBadgeVariant.non_applicable).toBe('neutral');
    });
  });
});
