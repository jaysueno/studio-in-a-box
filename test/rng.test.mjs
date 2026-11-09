import { describe, expect, it } from 'vitest';
import { makeRng, uid } from '../lib/rng.mjs';

describe('the seeded generator', () => {
  it('gives the same sequence for the same seed', () => {
    const a = makeRng(7);
    const b = makeRng(7);
    const left = Array.from({ length: 100 }, () => a.next());
    const right = Array.from({ length: 100 }, () => b.next());
    expect(left).toEqual(right);
  });

  it('gives a different sequence for a different seed', () => {
    const a = makeRng(7);
    const b = makeRng(8);
    const left = Array.from({ length: 20 }, () => a.next());
    const right = Array.from({ length: 20 }, () => b.next());
    expect(left).not.toEqual(right);
  });

  it('keeps integers inside the asked range', () => {
    const rng = makeRng(7);
    for (let i = 0; i < 500; i += 1) {
      const value = rng.int(9, 17);
      expect(value).toBeGreaterThanOrEqual(9);
      expect(value).toBeLessThanOrEqual(17);
      expect(Number.isInteger(value)).toBe(true);
    }
  });

  it('draws version 4 shaped identifiers from the seed', () => {
    const rng = makeRng(7);
    const first = uid(rng);
    expect(first).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(uid(makeRng(7))).toBe(first);
    expect(uid(makeRng(7))).not.toBe(uid(makeRng(8)));
  });
});
