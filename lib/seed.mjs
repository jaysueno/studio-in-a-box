// The generated studio. Pure: the same seed gives the same rows, byte for byte, on any machine.
// Nothing here reads the clock, the network or Math.random.

import { makeRng, uid } from './rng.mjs';

export const DEFAULT_SEED = 7;
export const STUDIO_NAME = 'Cedarline Studio';
export const MEMBER_COUNT = 60;
export const CLASS_CAPACITY = 10;
export const PAYMENT_DAYS = ['2027-02-10', '2027-02-11'];
export const CLOSED_DAY = PAYMENT_DAYS[1];

const STAFF = [
  { full_name: 'Ines Calder', role: 'owner', email: 'ines.calder@example.test' },
  { full_name: 'Tomas Reyes', role: 'front_desk', email: 'tomas.reyes@example.test' },
  { full_name: 'Nadia Brooks', role: 'instructor', email: 'nadia.brooks@example.test' },
  { full_name: 'Yusuf Adeyemi', role: 'instructor', email: 'yusuf.adeyemi@example.test' },
  { full_name: 'Lena Park', role: 'instructor', email: 'lena.park@example.test' },
];

// One shared password for the four demo users. It protects nothing: the stack is local and the
// data is invented.
export const DEMO_PASSWORD = 'cedarline-demo-2027';

export const DEMO_USERS = [
  { role: 'member', label: 'Member', email: 'member01@example.test' },
  { role: 'front_desk', label: 'Front desk', email: 'tomas.reyes@example.test' },
  { role: 'instructor', label: 'Instructor', email: 'nadia.brooks@example.test' },
  { role: 'owner', label: 'Owner', email: 'ines.calder@example.test' },
];

export const FIRST_CLASS_DAY = '2027-03-01';

const FIRST_NAMES = [
  'Alma', 'Axel', 'Bea', 'Cass', 'Dara', 'Eli', 'Fern', 'Gio', 'Hana', 'Iris',
  'Joss', 'Kai', 'Lior', 'Mina', 'Nico', 'Oona', 'Paz', 'Quinn', 'Rhea', 'Sol',
  'Tess', 'Uma', 'Vero', 'Wren', 'Yara', 'Zane', 'Abra', 'Bela', 'Cora', 'Dev',
  'Enzo', 'Fira', 'Gale', 'Hugo', 'Inez', 'Juno', 'Kira', 'Milo', 'Nia', 'Orla',
  'Pia', 'Rune', 'Sena', 'Thea', 'Ula', 'Vesa', 'Wim', 'Xena', 'Yuki', 'Zora',
];

const LAST_NAMES = [
  'Abar', 'Bello', 'Cano', 'Duarte', 'Egan', 'Ferrer', 'Gallo', 'Hart', 'Ibarra',
  'Jensen', 'Kato', 'Lorne', 'Mercer', 'Nava', 'Okafor', 'Pike', 'Quiroz', 'Rossi',
  'Sato', 'Ueda', 'Vale', 'Ward', 'Xu', 'Yap', 'Zorn', 'Ambrose', 'Brant',
  'Chesney', 'Doran', 'East',
];

const CLASS_NAMES = [
  'Morning Flow', 'Slow Strength', 'Breath and Balance',
  'Evening Stretch', 'Core Basics', 'Mobility Lab',
];

const CLASS_DAYS = [
  '2027-03-01', '2027-03-03', '2027-03-05',
  '2027-03-08', '2027-03-10', '2027-03-12',
  '2027-03-15', '2027-03-17', '2027-03-19',
  '2027-03-22', '2027-03-24', '2027-03-26',
];

const PRICES = { 1: 12, 2: 24, 3: 33, 4: 40, 8: 75, 12: 110 };

const PACKAGE_NAMES = {
  1: 'Single class', 2: 'Two class pack', 3: 'Three class pack',
  4: 'Four class pack', 8: 'Eight class pack', 12: 'Twelve class pack',
};

const JOINED_DAYS = ['2026-12-01', '2027-01-05', '2027-01-20'];

const pad = (n) => String(n).padStart(2, '0');

function stamp(day, hour, minute) {
  return `${day}T${pad(hour)}:${pad(minute)}:00Z`;
}

function minusOneDay(value) {
  const millis = Date.parse(value) - 24 * 60 * 60 * 1000;
  return new Date(millis).toISOString().replace('.000Z', 'Z');
}

const DAY_MS = 24 * 60 * 60 * 1000;

function shiftDays(anchor) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(anchor)) {
    throw new Error('--anchor needs a date as YYYY-MM-DD');
  }
  const target = Date.parse(`${anchor}T00:00:00Z`);
  const first = Date.parse(`${FIRST_CLASS_DAY}T00:00:00Z`);
  if (Number.isNaN(target)) throw new Error('--anchor needs a real calendar date');
  return Math.round((target - first) / DAY_MS);
}

const shiftDay = (value, days) =>
  new Date(Date.parse(`${value}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10);

const shiftStamp = (value, days) =>
  new Date(Date.parse(value) + days * DAY_MS).toISOString().replace('.000Z', 'Z');

// Moves every date in the studio by whole days, so the first class week starts on the anchor.
function shiftStudio(studio, days) {
  for (const member of studio.members) {
    member.joined_on = shiftDay(member.joined_on, days);
  }
  for (const entry of studio.packages) {
    entry.purchased_at = shiftStamp(entry.purchased_at, days);
    entry.expires_on = shiftDay(entry.expires_on, days);
  }
  for (const session of studio.classes) {
    session.starts_at = shiftStamp(session.starts_at, days);
  }
  for (const booking of studio.bookings) {
    booking.booked_at = shiftStamp(booking.booked_at, days);
  }
  for (const row of studio.ledger) {
    row.occurred_at = shiftStamp(row.occurred_at, days);
  }
  for (const payment of studio.payments) {
    payment.paid_at = shiftStamp(payment.paid_at, days);
  }
  for (const close of studio.closes) {
    close.day = shiftDay(close.day, days);
    close.closed_at = shiftStamp(close.closed_at, days);
  }
  return studio;
}

// Credits and uses per member. Member 0 keeps exactly one credit, members 1 and 3 end at zero,
// and no other member ends at exactly one, so the checks have a single, stable fixture for the
// last-credit race.
function planForMember(index, rng) {
  if (index === 0) return { credits: 1, uses: 0, refund: 0, expire: 0 };
  if (index === 1) return { credits: 2, uses: 2, refund: 0, expire: 0 };
  if (index === 2) return { credits: 4, uses: 2, refund: 1, expire: 0 };
  if (index === 3) return { credits: 3, uses: 0, refund: 0, expire: 3 };

  const credits = rng.pick([4, 8, 12]);
  // At most four uses per member keeps the total below the 240 seats, so every booking finds a
  // free class and no member is left one credit short of their plan.
  const uses = rng.pick([0, 2, 4]);
  return { credits, uses, refund: 0, expire: 0 };
}

export function generateStudio(seed = DEFAULT_SEED, options = {}) {
  const rng = makeRng(seed);

  const staff = STAFF.map((entry) => ({ id: uid(rng), ...entry }));
  const owner = staff.find((entry) => entry.role === 'owner');
  const frontDesk = staff.find((entry) => entry.role === 'front_desk');
  const instructors = staff.filter((entry) => entry.role === 'instructor');

  const members = [];
  const usedNames = new Set();
  for (let i = 0; i < MEMBER_COUNT; i += 1) {
    let fullName = '';
    do {
      fullName = `${rng.pick(FIRST_NAMES)} ${rng.pick(LAST_NAMES)}`;
    } while (usedNames.has(fullName));
    usedNames.add(fullName);
    members.push({
      id: uid(rng),
      full_name: fullName,
      email: `member${pad(i + 1)}@example.test`,
      joined_on: rng.pick(JOINED_DAYS),
    });
  }

  const classes = [];
  CLASS_DAYS.forEach((day, index) => {
    const times = ['09:00:00', '18:00:00'];
    times.forEach((time, slot) => {
      classes.push({
        id: uid(rng),
        name: CLASS_NAMES[(index + slot) % CLASS_NAMES.length],
        instructor_id: instructors[(index + slot) % instructors.length].id,
        starts_at: `${day}T${time}Z`,
        duration_minutes: 60,
        capacity: CLASS_CAPACITY,
      });
    });
  });

  const packages = [];
  const payments = [];
  const ledger = [];
  const bookings = [];
  const plans = [];

  members.forEach((member, index) => {
    const plan = planForMember(index, rng);
    plans.push(plan);

    const packageId = uid(rng);
    const payDay = index === 0 ? PAYMENT_DAYS[1] : index === 1
      ? PAYMENT_DAYS[0] : rng.pick(PAYMENT_DAYS);
    const purchasedAt = stamp(payDay, rng.int(9, 17), rng.int(0, 59));
    const price = PRICES[plan.credits];

    packages.push({
      id: packageId,
      member_id: member.id,
      name: PACKAGE_NAMES[plan.credits],
      credits: plan.credits,
      price,
      purchased_at: purchasedAt,
      expires_on: index === 3 ? '2027-02-12' : '2027-09-30',
    });

    ledger.push({
      id: uid(rng),
      package_id: packageId,
      member_id: member.id,
      kind: 'issue',
      credits: plan.credits,
      occurred_at: purchasedAt,
    });

    payments.push({
      id: uid(rng),
      member_id: member.id,
      package_id: packageId,
      amount: price,
      method: index === 0 ? 'cash' : rng.pick(['cash', 'card']),
      paid_at: purchasedAt,
      recorded_by: frontDesk.id,
    });
  });

  const occupancy = new Map(classes.map((entry) => [entry.id, 0]));

  members.forEach((member, index) => {
    const plan = plans[index];
    const booked = new Set();
    for (let step = 0; step < plan.uses; step += 1) {
      let slot = (index * 5 + step * 7) % classes.length;
      let guard = 0;
      while (guard < classes.length
        && (booked.has(classes[slot].id)
          || occupancy.get(classes[slot].id) >= CLASS_CAPACITY)) {
        slot = (slot + 1) % classes.length;
        guard += 1;
      }
      if (guard >= classes.length) break;
      const session = classes[slot];
      booked.add(session.id);
      occupancy.set(session.id, occupancy.get(session.id) + 1);
      const bookedAt = minusOneDay(session.starts_at);
      bookings.push({
        id: uid(rng),
        member_id: member.id,
        class_id: session.id,
        package_id: packages[index].id,
        booked_at: bookedAt,
      });
      ledger.push({
        id: uid(rng),
        package_id: packages[index].id,
        member_id: member.id,
        kind: 'use',
        credits: -1,
        occurred_at: bookedAt,
      });
    }
  });

  ledger.push({
    id: uid(rng),
    package_id: packages[2].id,
    member_id: members[2].id,
    kind: 'refund',
    credits: 1,
    occurred_at: '2027-02-15T10:00:00Z',
  });

  ledger.push({
    id: uid(rng),
    package_id: packages[3].id,
    member_id: members[3].id,
    kind: 'expire',
    credits: -3,
    occurred_at: '2027-02-12T00:00:00Z',
  });

  const cashOnClosedDay = payments
    .filter((entry) => entry.method === 'cash' && entry.paid_at.startsWith(CLOSED_DAY))
    .reduce((sum, entry) => sum + entry.amount, 0);

  const closes = [{
    day: CLOSED_DAY,
    expected: cashOnClosedDay,
    counted: cashOnClosedDay,
    difference: 0,
    note: null,
    signed_off_by: owner.id,
    closed_at: '2027-02-11T18:30:00Z',
  }];

  const studio = {
    studio: { name: STUDIO_NAME, seed: Number(seed), timezone: 'UTC' },
    staff,
    members,
    packages,
    classes,
    bookings,
    ledger,
    payments,
    closes,
  };

  if (options.anchor) {
    shiftStudio(studio, shiftDays(options.anchor));
    studio.studio.anchor = options.anchor;
  }

  return studio;
}
