import { describe, expect, it } from 'vitest';
import { formatDuration, initials } from './format';

describe('formatDuration', () => {
  it('formats whole minutes and seconds', () => expect(formatDuration(185.8)).toBe('3:05'));
  it('handles unavailable durations', () => expect(formatDuration(null)).toBe('—'));
});

describe('initials', () => {
  it('returns two uppercase title characters', () => expect(initials('afterglow')).toBe('AF'));
  it('returns a music note for empty titles', () => expect(initials('')).toBe('♪'));
});
