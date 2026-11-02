import { describe, expect, it } from 'vitest';
import { countNight } from '../src/digest/counts.js';

describe('countNight', () => {
  it('counts run lines per status, not last status', () => {
    expect(countNight('runs', '2026-10-28')).toEqual({ ok: 10, retry: 4, fail: 1 });
  });

  it('is null for a night with no file', () => {
    expect(countNight('runs', '1999-01-01')).toBeNull();
  });
});
