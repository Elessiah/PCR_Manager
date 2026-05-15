import { describe, it, expect } from 'vitest';
import { cn } from '../cn';

describe('cn', () => {
  it('should join two strings with space', () => {
    expect(cn('a', 'b')).toBe('a b');
  });

  it('should filter out falsy values', () => {
    expect(cn('a', false, null, 'b', undefined)).toBe('a b');
  });

  it('should return empty string for no args', () => {
    expect(cn()).toBe('');
  });

  it('should return empty string for only undefined', () => {
    expect(cn(undefined)).toBe('');
  });

  it('should filter out empty strings', () => {
    expect(cn('a', '', 'b')).toBe('a b');
  });

  it('should handle multiple falsy values in a row', () => {
    expect(cn('a', false, null, undefined, 'b')).toBe('a b');
  });
});
