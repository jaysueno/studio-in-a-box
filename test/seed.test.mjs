import { describe, expect, it } from 'vitest';
import {
  DEFAULT_SEED,
  DEMO_PASSWORD,
  DEMO_USERS,
  generateStudio,
  MEMBER_COUNT,
  PAYMENT_DAYS,
  CLASS_CAPACITY,
} from '../lib/seed.mjs';

const data = generateStudio(DEFAULT_SEED);

function remainingByPackage(studio) {
  const remaining = new Map(studio.packages.map((entry) => [entry.id, 0]));
  for (const row of studio.ledger) {
    remaining.set(row.package_id, remaining.get(row.package_id) + row.credits);
  }
  return remaining;
}

function remainingByMember(studio) {
  const remaining = new Map();
  for (const [packageId, credits] of remainingByPackage(studio)) {
    const entry = studio.packages.find((row) => row.id === packageId);
    remaining.set(entry.member_id, (remaining.get(entry.member_id) || 0) + credits);
  }
  return remaining;
}

describe('the generated studio', () => {
  it('is identical for the same seed', () => {
    expect(generateStudio(7)).toEqual(generateStudio(7));
  });

  it('is different for a different seed', () => {
    expect(generateStudio(8)).not.toEqual(generateStudio(7));
  });

  it('keeps the fixed calendar by default and shifts it to an anchor', () => {
    const fixed = generateStudio(7);
    expect([...fixed.classes].map((c) => c.starts_at).sort()[0].slice(0, 10))
      .toBe('2027-03-01');

    const anchored = generateStudio(7, { anchor: '2026-11-16' });
    expect([...anchored.classes].map((c) => c.starts_at).sort()[0].slice(0, 10))
      .toBe('2026-11-16');
    expect(anchored.closes[0].day).toBe('2026-10-29');
    expect(anchored.payments[0].paid_at.slice(0, 10)).toBe('2026-10-29');
  });

  it('ships one shared demo password and four demo users', () => {
    expect(DEMO_PASSWORD.length).toBeGreaterThanOrEqual(12);
    expect(DEMO_USERS.map((u) => u.role).sort())
      .toEqual(['front_desk', 'instructor', 'member', 'owner']);
    for (const entry of DEMO_USERS) {
      expect(entry.email).toMatch(/@example\.test$/);
    }
    const emails = new Set([
      ...data.staff.map((entry) => entry.email),
      ...data.members.map((entry) => entry.email),
    ]);
    for (const entry of DEMO_USERS) expect(emails.has(entry.email)).toBe(true);
  });

  it('has the staff the roles need', () => {
    const roles = data.staff.map((entry) => entry.role).sort();
    expect(roles).toEqual(['front_desk', 'instructor', 'instructor', 'instructor', 'owner']);
  });

  it('has about sixty members, each with one package', () => {
    expect(data.members).toHaveLength(MEMBER_COUNT);
    expect(data.packages).toHaveLength(MEMBER_COUNT);
    expect(new Set(data.members.map((entry) => entry.email)).size).toBe(MEMBER_COUNT);
  });

  it('runs four weeks of classes in the future, all with a free seat', () => {
    expect(data.classes).toHaveLength(24);
    const opened = new Set();
    const booked = new Map();
    for (const entry of data.bookings) {
      booked.set(entry.class_id, (booked.get(entry.class_id) || 0) + 1);
    }
    for (const session of data.classes) {
      expect(Date.parse(session.starts_at)).toBeGreaterThanOrEqual(Date.parse('2027-03-01T00:00:00Z'));
      expect(session.capacity).toBe(CLASS_CAPACITY);
      expect(booked.get(session.id) || 0).toBeLessThan(session.capacity);
      opened.add(session.starts_at.slice(0, 10));
    }
    expect(opened.size).toBe(12);
  });

  it('books each member into a class once, with a package they own', () => {
    const packages = new Map(data.packages.map((entry) => [entry.id, entry]));
    const seen = new Set();
    for (const entry of data.bookings) {
      const key = `${entry.member_id}:${entry.class_id}`;
      expect(seen.has(key)).toBe(false);
      seen.add(key);
      expect(packages.get(entry.package_id).member_id).toBe(entry.member_id);
    }
  });

  it('keeps every ledger row, and every package, in balance', () => {
    const remaining = remainingByPackage(data);
    for (const packageEntry of data.packages) {
      expect(remaining.get(packageEntry.id)).not.toBeUndefined();
      expect(remaining.get(packageEntry.id)).toBeLessThanOrEqual(packageEntry.credits);
    }
    for (const row of data.ledger) {
      if (row.kind === 'issue' || row.kind === 'refund') expect(row.credits).toBeGreaterThan(0);
      else expect(row.credits).toBeLessThan(0);
    }
  });

  it('has one member with exactly one credit and at least one member at zero', () => {
    const totals = [...remainingByMember(data).values()];
    expect(totals.filter((value) => value === 1)).toHaveLength(1);
    expect(totals.filter((value) => value === 0).length).toBeGreaterThan(0);
  });

  it('carries every ledger kind at least once', () => {
    const kinds = new Set(data.ledger.map((row) => row.kind));
    expect([...kinds].sort()).toEqual(['expire', 'issue', 'refund', 'use']);
  });

  it('puts two days of payments inside working hours, in UTC', () => {
    const days = new Set(data.payments.map((entry) => entry.paid_at.slice(0, 10)));
    expect([...days].sort()).toEqual([...PAYMENT_DAYS].sort());
    for (const entry of data.payments) {
      const hour = Number(entry.paid_at.slice(11, 13));
      expect(hour).toBeGreaterThanOrEqual(9);
      expect(hour).toBeLessThanOrEqual(17);
    }
  });

  it('closes one day, and the expected amount is that day\'s cash', () => {
    expect(data.closes).toHaveLength(1);
    const close = data.closes[0];
    const cash = data.payments
      .filter((entry) => entry.method === 'cash' && entry.paid_at.slice(0, 10) === close.day)
      .reduce((sum, entry) => sum + entry.amount, 0);
    expect(close.expected).toBe(cash);
    expect(close.counted).toBe(cash);
    expect(close.difference).toBe(0);
  });
});
