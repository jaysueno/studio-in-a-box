import { describe, expect, it } from 'vitest';
import { generateStudio } from '../lib/seed.mjs';
import { renderDump, sqlValue } from '../lib/sql.mjs';

describe('the seed dump', () => {
  it('quotes text, doubles single quotes, and writes null as NULL', () => {
    expect(sqlValue("O'Hara")).toBe("'O''Hara'");
    expect(sqlValue(0)).toBe("'0'");
    expect(sqlValue(null)).toBe('NULL');
    expect(sqlValue(undefined)).toBe('NULL');
  });

  it('is byte identical for the same seed', () => {
    expect(renderDump(generateStudio(7))).toBe(renderDump(generateStudio(7)));
  });

  it('ships a full studio, well over the hundred line floor', () => {
    const text = renderDump(generateStudio(7));
    const nonEmpty = text.split('\n').filter((line) => line.trim());
    expect(nonEmpty.length).toBeGreaterThan(100);
    expect(nonEmpty[0]).toBe('-- studio-in-a-box seed dump');
    expect(text.trim().split('\n').pop()).toBe('commit;');
  });

  it('sorts the rows of every table by its first column', () => {
    const text = renderDump(generateStudio(7));
    const ids = text.split('\n')
      .filter((line) => line.startsWith('insert into public.members '))
      .map((line) => line.split("'")[1]);
    expect(ids.length).toBe(60);
    expect([...ids].sort()).toEqual(ids);
  });
});
